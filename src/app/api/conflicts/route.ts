import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { and, eq, lt, gt, ne, sql } from "drizzle-orm";

// POST /api/conflicts
// Body: { unit, checkIn, checkOut, excludeId? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { checkIn, checkOut, excludeId } = body;

    // Normalise unit — strip "Unit " prefix
    const unit = String(body.unit).replace(/^Unit\s*/i, "");

    if (!unit || !checkIn || !checkOut) {
      return NextResponse.json({ hasConflict: false, conflicts: [] });
    }

    const checkInDate  = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    const conditions = [
      eq(bookings.unit,    unit),
      lt(bookings.checkIn,  checkOutDate),
      gt(bookings.checkOut, checkInDate),
    ];

    if (excludeId) {
      conditions.push(ne(bookings.id, Number(excludeId)));
    }

    const found = await db
      .select({
        id:           bookings.id,
        guestName:    bookings.guestName,
        checkIn:      bookings.checkIn,
        checkOut:     bookings.checkOut,
        checkInTime:  bookings.checkInTime,
        checkOutTime: bookings.checkOutTime,
      })
      .from(bookings)
      .where(and(...conditions));

    return NextResponse.json({
      hasConflict: found.length > 0,
      conflicts:   found,
    });
  } catch (e) {
    console.error("[POST /api/conflicts]", e);
    return NextResponse.json({ error: "Failed to check conflicts" }, { status: 500 });
  }
}
