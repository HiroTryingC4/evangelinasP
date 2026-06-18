import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureBookingSourceColumn } from "@/lib/db-health";
import { bookings } from "@/lib/schema";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { calcPaymentStatus, calcRemaining, hasUnitTimeConflict, parseYMDToPHDate, toYMD, normalizeBookingSource } from "@/lib/utils";

function normalizeDateKey(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return toYMD(raw);
}

// GET /api/bookings/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureBookingSourceColumn();

    const [booking] = await db
      .select({
        id: bookings.id,
        guestName: bookings.guestName,
        contactNo: bookings.contactNo,
        bookingSource: bookings.bookingSource,
        bookingPlatform: bookings.bookingPlatform,
        unit: bookings.unit,
        checkIn: bookings.checkIn,
        checkInDateKey: bookings.checkInDateKey,
        checkInTime: bookings.checkInTime,
        checkOut: bookings.checkOut,
        checkOutDateKey: bookings.checkOutDateKey,
        checkOutTime: bookings.checkOutTime,
        hoursStayed: bookings.hoursStayed,
        totalFee: bookings.totalFee,
        dpAmount: bookings.dpAmount,
        dpDate: bookings.dpDate,
        dpMethod: bookings.dpMethod,
        dpReceivedBy: bookings.dpReceivedBy,
        fpAmount: bookings.fpAmount,
        fpDate: bookings.fpDate,
        fpMethod: bookings.fpMethod,
        fpReceivedBy: bookings.fpReceivedBy,
        apAmount: bookings.apAmount,
        apDate: bookings.apDate,
        apMethod: bookings.apMethod,
        apReceivedBy: bookings.apReceivedBy,
        remainingBalance: bookings.remainingBalance,
        paymentStatus: bookings.paymentStatus,
        hasConflict: bookings.hasConflict,
        createdAt: bookings.createdAt,
        updatedAt: bookings.updatedAt,
      })
      .from(bookings)
      .where(eq(bookings.id, Number(params.id)));

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    return NextResponse.json(booking);
  } catch (e) {
    console.error("[GET /api/bookings/id]", e);
    return NextResponse.json({ error: "Failed to fetch booking" }, { status: 500 });
  }
}

// PUT /api/bookings/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureBookingSourceColumn();

    const body = await req.json();
    const bookingId = Number(params.id);

    if (String(body?.paymentStatus ?? "").trim() === "Restore") {
      const [existing] = await db
        .select({
          id: bookings.id,
          dpAmount: bookings.dpAmount,
          fpAmount: bookings.fpAmount,
          totalFee: bookings.totalFee,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId));

      if (!existing) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }

      const dp = Number(existing.dpAmount) || 0;
      const fp = Number(existing.fpAmount) || 0;
      const ap = Number((existing as any).apAmount) || 0;
      const total = Number(existing.totalFee) || 0;

      const [updatedRestored] = await db
        .update(bookings)
        .set({
          paymentStatus: calcPaymentStatus(dp, fp, total, ap),
          remainingBalance: calcRemaining(dp, fp, total, ap),
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId))
        .returning();

      return NextResponse.json(updatedRestored);
    }

    if (String(body?.paymentStatus ?? "").trim() === "Canceled") {
      const [updatedCanceled] = await db
        .update(bookings)
        .set({
          paymentStatus: "Canceled",
          hasConflict: "OK",
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingId))
        .returning();

      if (!updatedCanceled) {
        return NextResponse.json({ error: "Booking not found" }, { status: 404 });
      }
      return NextResponse.json(updatedCanceled);
    }

    const dp    = Number(body.dpAmount)  || 0;
    const fp    = Number(body.fpAmount)  || 0;
    const ap    = Number(body.apAmount)  || 0;
    const total = Number(body.totalFee)  || 0;

    // Strip "Unit " prefix if sent
    const unitCode = String(body.unit).replace(/^Unit\s*/i, "");
    const checkInDate = parseYMDToPHDate(body.checkIn);
    const checkOutDate = parseYMDToPHDate(body.checkOut);
    const checkInDateKey = normalizeDateKey(body.checkIn);
    const checkOutDateKey = normalizeDateKey(body.checkOut);
    const bookingSource = normalizeBookingSource(body.bookingSource);

    // Re-check conflicts on edit, excluding this booking.
    const conflicts = await db
      .select({
        id: bookings.id,
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
          lt(bookings.checkIn, checkOutDate),
          gt(bookings.checkOut, checkInDate),
          ne(bookings.id, bookingId)
        )
      );

    const preciseConflicts = conflicts.filter((existing) =>
      hasUnitTimeConflict(
        {
          checkIn: checkInDate,
          checkInTime: body.checkInTime || "2:00 PM",
          checkOut: checkOutDate,
          checkOutTime: body.checkOutTime || "12:00 PM",
        },
        existing,
        0
      )
    );

    const hasConflict = preciseConflicts.length > 0 ? "CONFLICT" : "OK";

    const [updated] = await db
      .update(bookings)
      .set({
        guestName:        body.guestName?.trim(),
        contactNo:        body.contactNo?.trim() || null,
        bookingSource,
        bookingPlatform:  body.bookingPlatform?.trim() || "Direct",
        unit:             unitCode,
        checkIn:          checkInDate,
        checkInDateKey,
        checkInTime:      body.checkInTime  || "2:00 PM",
        checkOut:         checkOutDate,
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
        apAmount:         ap,
        apDate:           body.apDate       ? parseYMDToPHDate(body.apDate)  : null,
        apMethod:         body.apMethod     || null,
        apReceivedBy:     body.apReceivedBy || null,
        remainingBalance: calcRemaining(dp, fp, total, ap),
        paymentStatus:    calcPaymentStatus(dp, fp, total, ap),
        hasConflict,
        updatedAt:        new Date(),
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    console.error("[PUT /api/bookings/id]", e);
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }
}

// DELETE /api/bookings/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await ensureBookingSourceColumn();

    await db.delete(bookings).where(eq(bookings.id, Number(params.id)));
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/bookings/id]", e);
    return NextResponse.json({ error: "Failed to delete booking" }, { status: 500 });
  }
}
