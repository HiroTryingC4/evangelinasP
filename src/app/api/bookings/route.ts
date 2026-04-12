import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { eq, and, lt, gt, asc } from "drizzle-orm";
import { calcPaymentStatus, calcRemaining, toYMD } from "@/lib/utils";

// GET /api/bookings?unit=1558&status=DP+Paid
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
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
      const today = toYMD(new Date());
      all = all.filter((b) => toYMD(b.checkOut) >= today);
    }

    if (view === "past") {
      const today = toYMD(new Date());
      all = all.filter((b) => toYMD(b.checkOut) < today);
    }

    return NextResponse.json(all);
  } catch (e) {
    console.error("[GET /api/bookings]", e);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}

// POST /api/bookings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const dp    = Number(body.dpAmount)  || 0;
    const fp    = Number(body.fpAmount)  || 0;
    const total = Number(body.totalFee)  || 0;

    // Strip "Unit " prefix if frontend sent "Unit 1558" instead of "1558"
    const unitCode = String(body.unit).replace(/^Unit\s*/i, "");

    const checkIn  = new Date(body.checkIn);
    const checkOut = new Date(body.checkOut);

    // Conflict check — same unit, overlapping date range
    const conflicts = await db
      .select({ id: bookings.id, guestName: bookings.guestName })
      .from(bookings)
      .where(
        and(
          eq(bookings.unit, unitCode),
          lt(bookings.checkIn,  checkOut),
          gt(bookings.checkOut, checkIn),
        )
      );

    const hasConflict = conflicts.length > 0 ? "CONFLICT" : "OK";

    const [newBooking] = await db
      .insert(bookings)
      .values({
        guestName:        body.guestName?.trim(),
        contactNo:        body.contactNo?.trim() || null,
        unit:             unitCode,
        checkIn,
        checkInTime:      body.checkInTime  || "2:00 PM",
        checkOut,
        checkOutTime:     body.checkOutTime || "12:00 PM",
        hoursStayed:      Number(body.hoursStayed) || 0,
        totalFee:         total,
        dpAmount:         dp,
        dpDate:           body.dpDate       ? new Date(body.dpDate)  : null,
        dpMethod:         body.dpMethod     || null,
        dpReceivedBy:     body.dpReceivedBy || null,
        fpAmount:         fp,
        fpDate:           body.fpDate       ? new Date(body.fpDate)  : null,
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
