import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { toYMD } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const monthlyDateParam = searchParams.get("monthlyDate");
    const weeklyDateParam = searchParams.get("weeklyDate");
    const scope = searchParams.get("scope") || "all";

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

    const allBookings = await db
      .select()
      .from(bookings)
      .orderBy(desc(bookings.updatedAt), desc(bookings.id));

    // Calculate receiver breakdown - count ONLY what each person received
    const receiverMap = new Map<string, { total: number; bookingCount: number }>();

    allBookings.forEach((booking) => {
      const checkInDateKey = booking.checkInDateKey || toYMD(booking.checkIn);
      
      // Apply date filters
      if (scope === "week") {
        if (checkInDateKey < weekStartKey || checkInDateKey > weekEndKey) return;
      } else if (scope === "month" || scope === "month-half" || scope === "month-second-half") {
        if (!checkInDateKey.startsWith(monthKey)) return;
        if (scope === "month-half") {
          const day = Number(checkInDateKey.slice(8, 10));
          if (day < 1 || day > 15) return;
        }
        if (scope === "month-second-half") {
          const day = Number(checkInDateKey.slice(8, 10));
          if (day < 16) return;
        }
      }
      // scope === "all" has no date filter

      const totalFee = Math.max(0, Number(booking.totalFee ?? 0));
      let dpAmount = Math.max(0, Number(booking.dpAmount ?? 0));
      let fpAmount = Math.max(0, Number(booking.fpAmount ?? 0));
      const dpReceiver = String(booking.dpReceivedBy ?? "").trim();
      const fpReceiver = String(booking.fpReceivedBy ?? "").trim();

      // Apply same logic as dashboard: cap collected amount to totalFee
      const paidTotal = dpAmount + fpAmount;
      if (paidTotal > totalFee) {
        // Reduce FP first if overpaid
        const overpaid = paidTotal - totalFee;
        fpAmount = Math.max(0, fpAmount - overpaid);
      }

      // Count ONLY the DP amount to the DP receiver
      if (dpAmount > 0 && dpReceiver) {
        const current = receiverMap.get(dpReceiver) || { total: 0, bookingCount: 0 };
        current.total += dpAmount;
        current.bookingCount += 1;
        receiverMap.set(dpReceiver, current);
      }

      // Count ONLY the FP amount to the FP receiver
      if (fpAmount > 0 && fpReceiver) {
        const current = receiverMap.get(fpReceiver) || { total: 0, bookingCount: 0 };
        current.total += fpAmount;
        current.bookingCount += 1;
        receiverMap.set(fpReceiver, current);
      }

      // If FP has amount but no receiver, count as "Unassigned"
      if (fpAmount > 0 && !fpReceiver) {
        const current = receiverMap.get("UNASSIGNED") || { total: 0, bookingCount: 0 };
        current.total += fpAmount;
        current.bookingCount += 1;
        receiverMap.set("UNASSIGNED", current);
      }
    });

    const receivers = Array.from(receiverMap.entries())
      .map(([name, data]) => ({
        name,
        totalReceived: data.total,
        transactionCount: data.bookingCount,
      }))
      .sort((a, b) => {
        // Put UNASSIGNED last
        if (a.name === "UNASSIGNED") return 1;
        if (b.name === "UNASSIGNED") return -1;
        return b.totalReceived - a.totalReceived;
      });

    const grandTotal = receivers.reduce((sum, r) => sum + r.totalReceived, 0);

    return NextResponse.json(
      {
        scope,
        receivers,
        grandTotal,
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
    console.error("[GET /api/payments/receivers]", error);
    return NextResponse.json(
      { error: "Failed to load receiver breakdown" },
      { status: 500 }
    );
  }
}
