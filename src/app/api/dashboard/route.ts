import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings, unitConfigs } from "@/lib/schema";
import { asc } from "drizzle-orm";
import { UNITS as DEFAULT_UNITS, getSundayToSaturdayWeek, toYMD } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

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

    const configuredUnitCodes = configuredUnits.length > 0
      ? configuredUnits.map((u) => u.code)
      : DEFAULT_UNITS;

    // All bookings ever; normalize keys in-memory so legacy/stale fields do not affect totals.
    const allRaw = await db.select().from(bookings);
    const all = allRaw.map((b) => ({
      ...b,
      normalizedUnit: String(b.unit || "").replace(/^Unit\s*/i, "").trim(),
      // Prefer canonical date keys written from user input to avoid timestamp timezone drift.
      checkInKey: b.checkInDateKey || toYMD(b.checkIn),
      checkOutKey: b.checkOutDateKey || toYMD(b.checkOut),
    }));

    const bookingUnitCodes = Array.from(new Set(all.map((b) => b.normalizedUnit).filter(Boolean)));
    const configuredSet = new Set(configuredUnitCodes);
    const unitCodes = [...configuredUnitCodes, ...bookingUnitCodes.filter((code) => !configuredSet.has(code))];

    const selectedUnits = weeklyUnitsParam
      ? Array.from(new Set(
          weeklyUnitsParam
            .split(",")
            .map((u) => u.trim().replace(/^Unit\s*/i, ""))
            .filter((u) => unitCodes.includes(u))
        ))
      : [];

    const hasUnitFilter = selectedUnits.length > 0;

    // All bookings in the selected date range (for the main stats)
    const filtered = all.filter((b) => {
      const checkInKey = b.checkInKey;
      return checkInKey >= from && checkInKey <= to;
    });

    // ── TODAY ──────────────────────────────────────────────────────────────
    const todayStr = toYMD(new Date());

    const todayGuests = all.filter((b) => {
      const ci = b.checkInKey;
      const co = b.checkOutKey;
      return ci === todayStr || co === todayStr;
    });

    // ── THIS WEEK (Sunday → Saturday) ─────────────────────────────────────
    const week = getSundayToSaturdayWeek(weeklyDateParam || todayStr);
    const weekStart = week.start;
    const weekEnd = week.end;
    const weekStartYMD = week.startDate;
    const weekEndYMD = week.endDate;

    const weekBookings = all.filter((b) => {
      const ci = b.checkInKey;
      return ci >= weekStartYMD && ci <= weekEndYMD;
    });

    const weekBookingsFiltered = hasUnitFilter
      ? weekBookings.filter((b) => selectedUnits.includes(b.normalizedUnit))
      : weekBookings;

    const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyAnalysisDays = WEEKDAY.map((day, i) => {
      const dayDate = new Date(weekStart);
      dayDate.setUTCDate(weekStart.getUTCDate() + i);
      const dayStr = toYMD(dayDate);

      const dayBookings = weekBookingsFiltered.filter((b) => {
        const ci = b.checkInKey;
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
      const ub = weekBookings.filter((b) => b.normalizedUnit === unit);
      return {
        unit:     `Unit ${unit}`,
        unitCode: unit,
        revenue:  ub.reduce((s, b) => s + b.totalFee, 0),
        guests:   ub.length,
      };
    });

    // ── FILTERED SUMMARY ───────────────────────────────────────────────────
    const getCollectedForBooking = (b: typeof filtered[number]) => {
      const totalFee = Number(b.totalFee ?? 0);
      const dp = Number(b.dpAmount ?? 0);
      const fp = Number(b.fpAmount ?? 0);
      const paid = Math.max(0, dp + fp);
      return Math.min(totalFee, paid);
    };

    const totalRevenue   = filtered.reduce((s, b) => s + b.totalFee, 0);
    const expectedRevenue = totalRevenue;
    const activeRevenue   = filtered.reduce((s, b) => s + getCollectedForBooking(b), 0);
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
      const ub = filtered.filter((b) => b.normalizedUnit === unit);
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
      const mb = filtered.filter((b) => {
        const key = b.checkInKey;
        const monthNumber = Number(key.slice(5, 7));
        return monthNumber === i + 1;
      });
      const totalRevenue = mb.reduce((s, b) => s + b.totalFee, 0);
      const incomingPayment = mb.reduce((s, b) => s + getCollectedForBooking(b), 0);
      const waitingPayment = Math.max(0, totalRevenue - incomingPayment);
      return {
        month,
        revenue: totalRevenue,
        incomingPayment,
        waitingPayment,
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
        startDate: weekStartYMD,
        endDate:   weekEndYMD,
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
        startDate: weekStartYMD,
        endDate: weekEndYMD,
        days: weeklyAnalysisDays,
      },
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (e) {
    console.error("[GET /api/dashboard]", e);
    return NextResponse.json({ error: "Failed to load dashboard" }, {
      status: 500,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  }
}
