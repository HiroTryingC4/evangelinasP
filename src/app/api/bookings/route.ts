import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureBookingSourceColumn } from "@/lib/db-health";
import { bookings } from "@/lib/schema";
import { eq, and, lt, gt, asc } from "drizzle-orm";
import {
  calcPaymentStatus,
  calcRemaining,
  parseYMDToPHDate,
  toYMD,
  hasUnitTimeConflict,
  normalizeBookingSource,
} from "@/lib/utils";

function normalizeDateKey(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return toYMD(raw);
}

export const dynamic = "force-dynamic";

// GET /api/bookings?unit=1558&status=DP+Paid
export async function GET(req: NextRequest) {
  try {
    await ensureBookingSourceColumn();

    const { searchParams } = req.nextUrl;
    const unit   = searchParams.get("unit");
    const status = searchParams.get("status");
    const view   = searchParams.get("view") || "all";

    let all = await db
      .select()
      .from(bookings)
      .orderBy(asc(bookings.checkIn), asc(bookings.checkInTime), asc(bookings.id));

    if (unit)   all = all.filter((b) => b.unit === unit);
    if (status) all = all.filter((b) => b.paymentStatus === status);

    if (view === "upcoming") {
      // Keep all of today's records visible, even after their check-out time.
      const todayKey = toYMD(new Date());
      all = all.filter((b) => normalizeDateKey(b.checkOutDateKey || b.checkOut) >= todayKey);
    }

    if (view === "past") {
      const todayKey = toYMD(new Date());
      all = all.filter((b) => normalizeDateKey(b.checkOutDateKey || b.checkOut) < todayKey);
    }

    return NextResponse.json(all, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (e) {
    console.error("[GET /api/bookings]", e);
    return NextResponse.json({ error: "Failed to fetch bookings" }, {
      status: 500,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  }
}

// POST /api/bookings
export async function POST(req: NextRequest) {
  try {
    await ensureBookingSourceColumn();

    const body = await req.json();

    const dp    = Number(body.dpAmount)  || 0;
    const fp    = Number(body.fpAmount)  || 0;
    const total = Number(body.totalFee)  || 0;

    // Strip "Unit " prefix if frontend sent "Unit 1558" instead of "1558"
    const unitCode = String(body.unit).replace(/^Unit\s*/i, "");

    const checkIn  = parseYMDToPHDate(body.checkIn);
    const checkOut = parseYMDToPHDate(body.checkOut);
    const checkInDateKey = normalizeDateKey(body.checkIn);
    const checkOutDateKey = normalizeDateKey(body.checkOut);
    const bookingSource = normalizeBookingSource(body.bookingSource);

    // Pre-filter candidates by date overlap, then perform time-aware conflict check.
    const conflicts = await db
      .select({
        id: bookings.id,
        guestName: bookings.guestName,
        unit: bookings.unit,
        checkIn: bookings.checkIn,
        checkInTime: bookings.checkInTime,
        checkOut: bookings.checkOut,
        checkOutTime: bookings.checkOutTime,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.unit, unitCode),
          lt(bookings.checkIn,  checkOut),
          gt(bookings.checkOut, checkIn),
        )
      );

    const preciseConflicts = conflicts.filter((existing) =>
      hasUnitTimeConflict(
        {
          checkIn,
          checkInTime: body.checkInTime || "2:00 PM",
          checkOut,
          checkOutTime: body.checkOutTime || "12:00 PM",
        },
        existing,
        0
      )
    );

    const hasConflict = preciseConflicts.length > 0 ? "CONFLICT" : "OK";

    const [newBooking] = await db
      .insert(bookings)
      .values({
        guestName:        body.guestName?.trim(),
        contactNo:        body.contactNo?.trim() || null,
        bookingSource,
        unit:             unitCode,
        checkIn,
        checkInDateKey,
        checkInTime:      body.checkInTime  || "2:00 PM",
        checkOut,
        checkOutDateKey,
        checkOutTime:     body.checkOutTime || "12:00 PM",
        hoursStayed:      Number(body.hoursStayed) || 0,
        totalFee:         total,
        dpAmount:         dp,
        dpDate:           body.dpDate       ? parseYMDToPHDate(body.dpDate)  : null,
        dpMethod:         body.dpMethod     || null,
        dpReceivedBy:     body.dpReceivedBy || null,
        fpAmount:         fp,
        fpDate:           body.fpDate       ? parseYMDToPHDate(body.fpDate)  : null,
        fpMethod:         body.fpMethod     || null,
        fpReceivedBy:     body.fpReceivedBy || null,
        remainingBalance: calcRemaining(dp, fp, total),
        paymentStatus:    calcPaymentStatus(dp, fp, total),
        hasConflict,
      })
      .returning();

    return NextResponse.json(newBooking, { status: 201 });
  } catch (e) {
    console.error("[POST /api/bookings]", e);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
