import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const missingIds = [49, 57, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 98, 106];
    
    const foundBookings = await db
      .select()
      .from(bookings)
      .where(inArray(bookings.id, missingIds));

    const allBookings = await db.select().from(bookings);

    return NextResponse.json({
      missingIds,
      foundCount: foundBookings.length,
      foundBookings: foundBookings.map((b) => ({
        id: b.id,
        guestName: b.guestName,
        status: "EXISTS",
      })),
      totalBookingsInDB: allBookings.length,
      message:
        foundBookings.length === 0
          ? "All 19 IDs are deleted from database"
          : `Found ${foundBookings.length} of the 19 IDs in database`,
    });
  } catch (error) {
    console.error("[DEBUG check-bookings]", error);
    return NextResponse.json(
      { error: "Failed to check bookings" },
      { status: 500 }
    );
  }
}
