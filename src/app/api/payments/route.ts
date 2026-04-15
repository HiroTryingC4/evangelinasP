import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings, paymentTransfers, persons } from "@/lib/schema";
import { toYMD } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const type = searchParams.get("type");
    const receiver = searchParams.get("receiver");
    const weeklyDateParam = searchParams.get("weeklyDate");
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

    const [allBookings, allTransfers, allPersons] = await Promise.all([
      db.select().from(bookings).orderBy(desc(bookings.updatedAt), desc(bookings.id)),
      db.select().from(paymentTransfers).orderBy(desc(paymentTransfers.transferDate), desc(paymentTransfers.id)),
      db.select().from(persons),
    ]);

    const personMap = new Map(allPersons.map((p) => [p.id, p.name]));

    const records = allBookings.flatMap((booking) => {
      const totalFee = Math.max(0, Number(booking.totalFee ?? 0));
      const dpRaw = Math.max(0, Number(booking.dpAmount ?? 0));
      const fpRaw = Math.max(0, Number(booking.fpAmount ?? 0));
      const collectedTotal = Math.min(totalFee, dpRaw + fpRaw);
      
      const dpCollected = Math.min(dpRaw, collectedTotal);
      const fpCollected = Math.min(fpRaw, Math.max(0, collectedTotal - dpCollected));

      const bookingRecords = [];

      // Create separate records for DP and FP portions if they exist
      if (dpCollected > 0 && booking.dpReceivedBy) {
        bookingRecords.push({
          id: `booking-${booking.id}-dp`,
          bookingId: booking.id,
          guestName: booking.guestName,
          unit: booking.unit,
          normalizedUnit: String(booking.unit ?? "").replace(/^Unit\s*/i, "").trim(),
          paymentType: "BK" as const,
          amount: dpCollected,
          paymentDate: booking.checkIn,
          checkInDateKey: booking.checkInDateKey || toYMD(booking.checkIn),
          method: booking.dpMethod,
          receivedBy: booking.dpReceivedBy,
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
          portionType: "DP" as const,
        });
      }

      if (fpCollected > 0 && booking.fpReceivedBy) {
        bookingRecords.push({
          id: `booking-${booking.id}-fp`,
          bookingId: booking.id,
          guestName: booking.guestName,
          unit: booking.unit,
          normalizedUnit: String(booking.unit ?? "").replace(/^Unit\s*/i, "").trim(),
          paymentType: "BK" as const,
          amount: fpCollected,
          paymentDate: booking.checkIn,
          checkInDateKey: booking.checkInDateKey || toYMD(booking.checkIn),
          method: booking.fpMethod,
          receivedBy: booking.fpReceivedBy,
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
          portionType: "FP" as const,
        });
      }

      // If no DP or FP receivers, create a single record with full amount
      if (bookingRecords.length === 0) {
        bookingRecords.push({
          id: `booking-${booking.id}`,
          bookingId: booking.id,
          guestName: booking.guestName,
          unit: booking.unit,
          normalizedUnit: String(booking.unit ?? "").replace(/^Unit\s*/i, "").trim(),
          paymentType: "BK" as const,
          amount: collectedTotal,
          paymentDate: booking.checkIn,
          checkInDateKey: booking.checkInDateKey || toYMD(booking.checkIn),
          method: booking.dpMethod || booking.fpMethod,
          receivedBy: "",
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
        });
      }

      return bookingRecords;
    });

    const transferRecords = allTransfers.flatMap((transfer) => {
      const sender = personMap.get(transfer.senderId) ?? "";
      const recipient = personMap.get(transfer.recipientId) ?? "";
      const date = transfer.transferDate ?? transfer.createdAt ?? new Date();
      const amount = Number(transfer.amount ?? 0);

      const outgoing = {
        id: `tr-out-${transfer.id}`,
        bookingId: 0,
        guestName: `Transfer to ${recipient}`,
        unit: "TRANSFER",
          normalizedUnit: "TRANSFER",
        paymentType: "TR" as const,
        amount: -amount,
        paymentDate: date,
        method: transfer.paymentMethod,
        receivedBy: sender,
        bookingDate: date,
        checkInTime: "",
        checkOutTime: "",
        paymentStatus: "Transferred",
        remainingBalance: 0,
        dpDate: null,
      };

      const incoming = {
        id: `tr-in-${transfer.id}`,
        bookingId: 0,
        guestName: `Transfer from ${sender}`,
        unit: "TRANSFER",
          normalizedUnit: "TRANSFER",
        paymentType: "TR" as const,
        amount,
        paymentDate: date,
        method: transfer.paymentMethod,
        receivedBy: recipient,
        bookingDate: date,
        checkInTime: "",
        checkOutTime: "",
        paymentStatus: "Transferred",
        remainingBalance: 0,
        dpDate: null,
      };

      return [outgoing, incoming];
    });

    const allRecords = [...records, ...transferRecords];

    const filtered = allRecords.filter((record) => {
      if (type && record.paymentType !== type) return false;
      if (receiver && record.receivedBy !== receiver) return false;

      if (scope !== "all") {
        if (record.paymentType === "BK") {
          const bookingCheckInKey = record.checkInDateKey || toYMD(record.bookingDate);
          if (bookingCheckInKey < weekStartKey || bookingCheckInKey > weekEndKey) return false;
        } else {
          const transferDateKey = toYMD(record.paymentDate ?? record.bookingDate);
          if (transferDateKey < weekStartKey || transferDateKey > weekEndKey) return false;
        }
      }

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
