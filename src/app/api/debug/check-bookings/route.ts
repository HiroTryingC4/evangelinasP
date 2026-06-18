import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureBookingSourceColumn } from "@/lib/db-health";
import { bookings } from "@/lib/schema";
import { inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureBookingSourceColumn();

    const missingIds = [49, 57, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 98, 106];
    
    const foundBookings = await db
      .select()
      .from(bookings)
      .where(inArray(bookings.id, missingIds));

    const allBookings = await db.select({
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
    }).from(bookings);

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
