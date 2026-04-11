import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const receiver = searchParams.get("receiver");
    const weeklyDateParam = searchParams.get("weeklyDate");

    const weeklyAnchor = weeklyDateParam
      ? new Date(`${weeklyDateParam}T12:00:00`)
      : new Date();
    const anchor = Number.isNaN(weeklyAnchor.getTime()) ? new Date() : weeklyAnchor;
    const weekStart = new Date(anchor);
    weekStart.setDate(anchor.getDate() - anchor.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const allBookings = await db
      .select()
      .from(bookings)
      .orderBy(desc(bookings.updatedAt), desc(bookings.id));

    const records = allBookings.flatMap((booking) => {
      const items = [] as Array<{
        id: string;
        bookingId: number;
        guestName: string;
        unit: string;
        paymentType: "DP" | "FP";
        amount: number;
        paymentDate: Date | null;
        method: string | null;
        receivedBy: string | null;
        bookingDate: Date;
        checkInTime: string;
        checkOutTime: string;
        paymentStatus: string;
      }>;

      if (booking.dpAmount > 0) {
        items.push({
          id: `dp-${booking.id}`,
          bookingId: booking.id,
          guestName: booking.guestName,
          unit: booking.unit,
          paymentType: "DP",
          amount: booking.dpAmount,
          paymentDate: booking.dpDate,
          method: booking.dpMethod,
          receivedBy: booking.dpReceivedBy,
          bookingDate: booking.checkIn,
          checkInTime: booking.checkInTime,
          checkOutTime: booking.checkOutTime,
          paymentStatus: booking.paymentStatus,
        });
      }

      if (booking.fpAmount > 0) {
        items.push({
          id: `fp-${booking.id}`,
          bookingId: booking.id,
          guestName: booking.guestName,
          unit: booking.unit,
          paymentType: "FP",
          amount: booking.fpAmount,
          paymentDate: booking.fpDate,
          method: booking.fpMethod,
          receivedBy: booking.fpReceivedBy,
          bookingDate: booking.checkIn,
          checkInTime: booking.checkInTime,
          checkOutTime: booking.checkOutTime,
          paymentStatus: booking.paymentStatus,
        });
      }

      return items;
    });

    const filtered = records.filter((record) => {
      if (type && record.paymentType !== type) return false;
      if (receiver && record.receivedBy !== receiver) return false;

      const paymentDate = new Date(record.paymentDate ?? record.bookingDate);
      if (paymentDate < weekStart || paymentDate > weekEnd) return false;

      return true;
    });

    filtered.sort((a, b) => {
      const dateA = new Date(a.paymentDate ?? a.bookingDate).getTime();
      const dateB = new Date(b.paymentDate ?? b.bookingDate).getTime();
      if (dateA !== dateB) return dateB - dateA;
      if (a.paymentType !== b.paymentType) return a.paymentType === "FP" ? -1 : 1;
      return b.bookingId - a.bookingId;
    });

    return NextResponse.json({
      records: filtered,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
    });
  } catch (error) {
    console.error("[GET /api/payments]", error);
    return NextResponse.json({ error: "Failed to load payment records" }, { status: 500 });
  }
}
