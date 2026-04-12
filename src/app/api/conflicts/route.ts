import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { and, eq, lt, gt, ne } from "drizzle-orm";
import { hasUnitTimeConflict, parseYMDToUTCDate } from "@/lib/utils";

// POST /api/conflicts
// Body: { unit, checkIn, checkOut, excludeId? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { checkIn, checkInTime, checkOut, checkOutTime, excludeId } = body;

    // Normalise unit — strip "Unit " prefix
    const unit = String(body.unit).replace(/^Unit\s*/i, "");

    if (!unit || !checkIn || !checkOut) {
      return NextResponse.json({ hasConflict: false, conflicts: [] });
    }

    const checkInDate  = parseYMDToUTCDate(checkIn);
    const checkOutDate = parseYMDToUTCDate(checkOut);

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
        unit:         bookings.unit,
        guestName:    bookings.guestName,
        checkIn:      bookings.checkIn,
        checkOut:     bookings.checkOut,
        checkInTime:  bookings.checkInTime,
        checkOutTime: bookings.checkOutTime,
      })
      .from(bookings)
      .where(and(...conditions));

    const preciseConflicts = found.filter((existing) =>
      hasUnitTimeConflict(
        {
          checkIn,
          checkInTime: checkInTime || "2:00 PM",
          checkOut,
          checkOutTime: checkOutTime || "12:00 PM",
        },
        existing,
        0
      )
    );

    return NextResponse.json({
      hasConflict: preciseConflicts.length > 0,
      conflicts:   preciseConflicts,
    });
  } catch (e) {
    console.error("[POST /api/conflicts]", e);
    return NextResponse.json({ error: "Failed to check conflicts" }, { status: 500 });
  }
}
