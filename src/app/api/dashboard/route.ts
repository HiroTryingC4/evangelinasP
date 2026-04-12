import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings, unitConfigs } from "@/lib/schema";
import { gte, lte, and, asc } from "drizzle-orm";
import { UNITS as DEFAULT_UNITS, toYMD } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Date filter defaults to current year
    const year = new Date().getFullYear();
    const from = searchParams.get("from") || `${year}-01-01`;
    const to   = searchParams.get("to")   || `${year}-12-31`;
    const weeklyDateParam = searchParams.get("weeklyDate");
    const weeklyUnitsParam = searchParams.get("weeklyUnits");

    const configuredUnits = await db
      .select({ code: unitConfigs.code })
      .from(unitConfigs)
      .orderBy(asc(unitConfigs.sortOrder), asc(unitConfigs.id));

    const unitCodes = configuredUnits.length > 0
      ? configuredUnits.map((u) => u.code)
      : DEFAULT_UNITS;

    const selectedUnits = weeklyUnitsParam
      ? Array.from(new Set(
          weeklyUnitsParam
            .split(",")
            .map((u) => u.trim().replace(/^Unit\s*/i, ""))
            .filter((u) => unitCodes.includes(u))
        ))
      : [];

    const hasUnitFilter = selectedUnits.length > 0;

    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    // All bookings in the date range (for the main stats)
    const filtered = await db
      .select()
      .from(bookings)
      .where(and(gte(bookings.checkIn, fromDate), lte(bookings.checkIn, toDate)));

    // All bookings ever (for today + week sections — not date-filtered)
    const all = await db.select().from(bookings);

    // ── TODAY ──────────────────────────────────────────────────────────────
    const todayStr = toYMD(new Date());

    const todayGuests = all.filter((b) => {
      const ci = toYMD(b.checkIn);
      const co = toYMD(b.checkOut);
      return ci === todayStr || co === todayStr;
    });

    // ── THIS WEEK (Sunday → Saturday) ─────────────────────────────────────
    const weeklyAnchor = weeklyDateParam
      ? new Date(`${weeklyDateParam}T12:00:00`)
      : new Date(`${todayStr}T12:00:00`);
    const anchor = Number.isNaN(weeklyAnchor.getTime()) ? new Date() : weeklyAnchor;

    const weekStart = new Date(anchor);
    weekStart.setDate(anchor.getDate() - anchor.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekBookings = all.filter((b) => {
      const ci = toYMD(b.checkIn);
      return ci >= toYMD(weekStart) && ci <= toYMD(weekEnd);
    });

    const weekBookingsFiltered = hasUnitFilter
      ? weekBookings.filter((b) => selectedUnits.includes(b.unit))
      : weekBookings;

    const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyAnalysisDays = WEEKDAY.map((day, i) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      const dayStr = toYMD(dayDate);

      const dayBookings = weekBookingsFiltered.filter((b) => {
        const ci = toYMD(b.checkIn);
        return ci === dayStr;
      });

      return {
        day,
        date: dayStr,
        revenue: dayBookings.reduce((s, b) => s + b.totalFee, 0),
        guests: dayBookings.length,
        bookings: dayBookings.length,
      };
    });

    const weeklyPerUnit = unitCodes.map((unit) => {
      const ub = weekBookings.filter((b) => b.unit === unit);
      return {
        unit:     `Unit ${unit}`,
        unitCode: unit,
        revenue:  ub.reduce((s, b) => s + b.totalFee, 0),
        guests:   ub.length,
      };
    });

    // ── FILTERED SUMMARY ───────────────────────────────────────────────────
    const totalRevenue   = filtered.reduce((s, b) => s + b.totalFee, 0);
    const expectedRevenue = totalRevenue;
    const activeRevenue   = filtered.reduce((s, b) => s + Math.max(0, b.totalFee - b.remainingBalance), 0);
    const collectedRevenue = activeRevenue;
    const totalBookings  = filtered.length;
    const avgPerBooking  = totalBookings > 0 ? totalRevenue / totalBookings : 0;
    const fullyPaid      = filtered.filter((b) => b.paymentStatus === "Fully Paid").length;
    const dpPaid         = filtered.filter((b) => b.paymentStatus === "DP Paid").length;
    const noDP           = filtered.filter((b) => b.paymentStatus === "No DP").length;
    const followUps      = filtered.filter((b) => b.remainingBalance > 0).length;
    const conflicts      = filtered.filter((b) => b.hasConflict === "CONFLICT").length;

    // Revenue + guest count per unit (filtered)
    const revenuePerUnit = unitCodes.map((unit) => {
      const ub = filtered.filter((b) => b.unit === unit);
      return {
        unit:      `Unit ${unit}`,
        unitCode:  unit,
        revenue:   ub.reduce((s, b) => s + b.totalFee, 0),
        guests:    ub.length,
        fullyPaid: ub.filter((b) => b.paymentStatus === "Fully Paid").length,
        dpPaid:    ub.filter((b) => b.paymentStatus === "DP Paid").length,
        noDP:      ub.filter((b) => b.paymentStatus === "No DP").length,
      };
    });

    // Monthly revenue (filtered)
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthlyRevenue = MONTHS.map((month, i) => {
      const mb = filtered.filter((b) => new Date(b.checkIn).getMonth() === i);
      return {
        month,
        revenue:  mb.reduce((s, b) => s + b.totalFee, 0),
        bookings: mb.length,
      };
    });

    // Outstanding balances (filtered)
    const outstanding = filtered
      .filter((b) => b.remainingBalance > 0)
      .map((b) => ({
        id:               b.id,
        guestName:        b.guestName,
        contactNo:        b.contactNo,
        unit:             b.unit,
        totalFee:         b.totalFee,
        remainingBalance: b.remainingBalance,
        paymentStatus:    b.paymentStatus,
        checkIn:          b.checkIn,
        checkOut:         b.checkOut,
      }));

    return NextResponse.json({
      summary: {
        totalRevenue,
        expectedRevenue,
        collectedRevenue,
        activeRevenue,
        totalBookings,
        avgPerBooking,
        fullyPaid,
        dpPaid,
        noDP,
        followUps,
        conflicts,
      },
      revenuePerUnit,
      monthlyRevenue,
      outstanding,
      today: {
        date:   todayStr,
        count:  todayGuests.length,
        guests: todayGuests.map((b) => ({
          id:               b.id,
          guestName:        b.guestName,
          contactNo:        b.contactNo,
          unit:             b.unit,
          checkIn:          b.checkIn,
          checkInTime:      b.checkInTime,
          checkOut:         b.checkOut,
          checkOutTime:     b.checkOutTime,
          totalFee:         b.totalFee,
          remainingBalance: b.remainingBalance,
          paymentStatus:    b.paymentStatus,
        })),
      },
      weekly: {
        revenue:   weekBookings.reduce((s, b) => s + b.totalFee, 0),
        guests:    weekBookings.length,
        perUnit:   weeklyPerUnit,
        startDate: toYMD(weekStart),
        endDate:   toYMD(weekEnd),
      },
      weeklyAnalysis: {
        scope: hasUnitFilter ? "multi" : "all",
        unitCodes: selectedUnits,
        label: hasUnitFilter
          ? (selectedUnits.length === 1
              ? `Unit ${selectedUnits[0]}`
              : `${selectedUnits.length} selected units`)
          : "All Units",
        revenue: weekBookingsFiltered.reduce((s, b) => s + b.totalFee, 0),
        guests: weekBookingsFiltered.length,
        startDate: toYMD(weekStart),
        endDate: toYMD(weekEnd),
        days: weeklyAnalysisDays,
      },
    });
  } catch (e) {
    console.error("[GET /api/dashboard]", e);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
