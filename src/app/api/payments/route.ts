import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, persons } from "@/lib/schema";
import { toYMD } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const type = searchParams.get("type");
    const receiver = searchParams.get("receiver");
    const weeklyDateParam = searchParams.get("weeklyDate");
    const monthlyDateParam = searchParams.get("monthlyDate");
    const scope = searchParams.get("scope") || "week";

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
    const weekStartKey = toYMD(weekStart);
    const weekEndKey = toYMD(weekEnd);

    const monthKey = monthlyDateParam || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    const [allBookings, allPersons] = await Promise.all([
      db.select().from(bookings).orderBy(desc(bookings.updatedAt), desc(bookings.id)),
      db.select().from(persons),
    ]);

    const personMap = new Map(allPersons.map((p) => [p.id, p.name]));

    const records = allBookings.map((booking) => {
      const totalFee = Math.max(0, Number(booking.totalFee ?? 0));
      const dpRaw = Math.max(0, Number(booking.dpAmount ?? 0));
      const fpRaw = Math.max(0, Number(booking.fpAmount ?? 0));
      const collectedTotal = Math.min(totalFee, dpRaw + fpRaw);

      const receivers = Array.from(new Set([
        String(booking.dpReceivedBy ?? "").trim(),
        String(booking.fpReceivedBy ?? "").trim(),
      ].filter(Boolean)));

      return {
        id: `booking-${booking.id}`,
        bookingId: booking.id,
        guestName: booking.guestName,
        unit: booking.unit,
        normalizedUnit: String(booking.unit ?? "").replace(/^Unit\s*/i, "").trim(),
        paymentType: "BK" as const,
        amount: collectedTotal,
        paymentDate: booking.checkIn,
        checkInDateKey: booking.checkInDateKey || toYMD(booking.checkIn),
        method: booking.fpMethod || booking.dpMethod,
        receivedBy: receivers.join(", ") || null,
        receiverNames: receivers,
        dpReceivedBy: booking.dpReceivedBy,
        fpReceivedBy: booking.fpReceivedBy,
        bookingDate: booking.checkIn,
        checkInTime: booking.checkInTime,
        checkOutTime: booking.checkOutTime,
        paymentStatus: booking.paymentStatus,
        remainingBalance: booking.remainingBalance,
        dpDate: booking.dpDate,
        fpDate: booking.fpDate,
        dpAmount: booking.dpAmount,
        fpAmount: booking.fpAmount,
        totalFee: booking.totalFee,
      };
    });

    const allRecords = records;

    const filtered = allRecords.filter((record) => {
      if (type && record.paymentType !== type) return false;
      if (receiver && record.receivedBy !== receiver) return false;

      const recordDateKey = record.checkInDateKey || toYMD(record.bookingDate);

      if (scope === "week") {
        if (recordDateKey < weekStartKey || recordDateKey > weekEndKey) return false;
      } else if (scope === "month") {
        if (!recordDateKey.startsWith(monthKey)) return false;
      } else if (scope === "month-half") {
        if (!recordDateKey.startsWith(monthKey)) return false;
        const day = Number(recordDateKey.slice(8, 10));
        if (day < 1 || day > 15) return false;
      } else if (scope === "month-second-half") {
        if (!recordDateKey.startsWith(monthKey)) return false;
        const day = Number(recordDateKey.slice(8, 10));
        if (day < 16) return false;
      }
      // scope === "all" has no date filter

      return true;
    });

    filtered.sort((a, b) => {
      const dateAKey = a.paymentType === "BK"
        ? (a.checkInDateKey || toYMD(a.bookingDate))
        : toYMD(a.paymentDate ?? a.bookingDate);
      const dateBKey = b.paymentType === "BK"
        ? (b.checkInDateKey || toYMD(b.bookingDate))
        : toYMD(b.paymentDate ?? b.bookingDate);
      if (dateAKey !== dateBKey) return dateBKey.localeCompare(dateAKey);
      if (a.paymentType !== b.paymentType) return a.paymentType === "BK" ? -1 : 1;
      return b.bookingId - a.bookingId;
    });

    return NextResponse.json(
      {
        records: filtered,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("[GET /api/payments]", error);
    return NextResponse.json(
      { error: "Failed to load payment records" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}
