import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, persons } from "@/lib/schema";
import { toYMD } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Debug: Force recompile
console.log("[Payments API] Loaded at", new Date().toISOString());

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

    console.log(`[Payments API] Fetched ${allBookings.length} bookings at ${new Date().toISOString()}`);

    const personMap = new Map(allPersons.map((p) => [p.id, p.name]));

    const records = allBookings.map((booking) => {
      const totalFee = Math.max(0, Number(booking.totalFee ?? 0));
      const dpRaw = Math.max(0, Number(booking.dpAmount ?? 0));
      const fpRaw = Math.max(0, Number(booking.fpAmount ?? 0));
      const checkInDateKey = booking.checkInDateKey || toYMD(booking.checkIn);
      
      if (booking.guestName === "RIEMAR" || booking.guestName === "RIALS") {
        console.log(`[DEBUG] Processing ${booking.guestName}:`, {
          id: booking.id,
          dpRaw,
          fpRaw,
          totalFee,
          checkInDateKey,
          dpReceivedBy: booking.dpReceivedBy,
          fpReceivedBy: booking.fpReceivedBy
        });
      }
      
      // Create ONE record per booking showing both DP and FP info
      return {
        id: `booking-${booking.id}`,
        bookingId: booking.id,
        guestName: booking.guestName,
        unit: booking.unit,
        normalizedUnit: String(booking.unit ?? "").replace(/^Unit\s*/i, "").trim(),
        paymentType: "BK" as const,
        amount: dpRaw + fpRaw, // Total paid amount
        paymentDate: booking.dpDate || booking.fpDate || booking.checkIn,
        checkInDateKey,
        method: booking.dpMethod || booking.fpMethod,
        receivedBy: null, // Not used for combined records
        receiverNames: [
          ...(dpRaw > 0 && booking.dpReceivedBy ? [String(booking.dpReceivedBy).trim()] : []),
          ...(fpRaw > 0 && booking.fpReceivedBy ? [String(booking.fpReceivedBy).trim()] : [])
        ].filter((v, i, a) => a.indexOf(v) === i), // Remove duplicates
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
    
    console.log(`[Payments API] Created ${allRecords.length} payment records from ${allBookings.length} bookings`);

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
    
    console.log(`[Payments API] After filtering: ${filtered.length} records (scope: ${scope}, type: ${type}, receiver: ${receiver})`);

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
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
          "Surrogate-Control": "no-store",
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
