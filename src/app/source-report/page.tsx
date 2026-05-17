"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Wallet, BarChart3 } from "lucide-react";
import { formatPHP, getSundayToSaturdayWeek, normalizeBookingSource, toYMD } from "@/lib/utils";
import type { Booking } from "@/lib/schema";

type SourceName = "Direct" | "TikTok" | "Facebook" | "Airbnb";
type MethodName = "Cash" | "GCash" | "Bank Transfer";

const SOURCE_ORDER: SourceName[] = ["Direct", "TikTok", "Facebook", "Airbnb"];
const METHOD_ORDER: MethodName[] = ["Cash", "GCash", "Bank Transfer"];
const CORE_UNITS = new Set(["1116", "1118", "1558", "1845"]);

type ManualExpenseEntry = {
  id: number;
  amount: number;
  comment: string;
  receiver: string;
};

type WeeklyRow = {
  dayKey: string;
  label: string;
  bookings: number;
  bySource: Record<SourceName, number>;
  methods: Record<MethodName, number>;
  paidTotal: number;
  guestList: Array<{
    id: number;
    guestName: string;
    unit: string | null;
    bookingSource: string | null;
    totalFee: number;
    dpAmount: number;
    fpAmount: number;
    dpReceivedBy?: string | null;
    fpReceivedBy?: string | null;
  }>;
};

type WeeklyReport = {
  rows: WeeklyRow[];
  summary: {
    totals: Record<SourceName, { bookings: number; methods: Record<MethodName, number> }>;
    methodTotals: Record<MethodName, number>;
    totalBookings: number;
    totalPaid: number;
  };
};

function addDays(baseYMD: string, days: number): string {
  const date = new Date(`${baseYMD}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toYMD(date);
}

function parseManualAmount(value: string): number {
  const normalized = value.replace(/[^0-9.]/g, "").trim();
  if (!normalized) return 0;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return amount;
}

function getMethodAmounts(booking: Booking): Record<MethodName, number> {
  const dpMethod = String(booking.dpMethod ?? "").trim().toLowerCase();
  const fpMethod = String(booking.fpMethod ?? "").trim().toLowerCase();

  const amounts: Record<MethodName, number> = {
    Cash: 0,
    GCash: 0,
    "Bank Transfer": 0,
  };

  const addAmount = (method: string, amount: number) => {
    const safeAmount = Math.max(0, amount);
    if (!safeAmount) return;

    if (method === "cash") amounts.Cash += safeAmount;
    else if (method === "gcash") amounts.GCash += safeAmount;
    else if (method === "bank transfer") amounts["Bank Transfer"] += safeAmount;
  };

  addAmount(dpMethod, Number(booking.dpAmount ?? 0));
  addAmount(fpMethod, Number(booking.fpAmount ?? 0));

  return amounts;
}

function bookingMatchesReceiver(booking: Booking, selectedReceiver: string): boolean {
  if (selectedReceiver === "__all__") return true;
  
  const dpReceiver = String(booking.dpReceivedBy ?? "").trim().toUpperCase();
  const fpReceiver = String(booking.fpReceivedBy ?? "").trim().toUpperCase();
  const selected = selectedReceiver.toUpperCase();
  
  // Show booking if this person received any payment
  return dpReceiver === selected || fpReceiver === selected;
}

function getMethodAmountsForReceiver(
  booking: Booking,
  selectedReceiver: string
): Record<MethodName, number> {
  const amounts: Record<MethodName, number> = {
    Cash: 0,
    GCash: 0,
    "Bank Transfer": 0,
  };

  if (selectedReceiver === "__all__") {
    // Show all payments
    const addAmount = (method: string, amount: number) => {
      const safeAmount = Math.max(0, amount);
      if (!safeAmount) return;

      const methodLower = method.toLowerCase();
      if (methodLower === "cash") amounts.Cash += safeAmount;
      else if (methodLower === "gcash") amounts.GCash += safeAmount;
      else if (methodLower === "bank transfer") amounts["Bank Transfer"] += safeAmount;
    };

    addAmount(String(booking.dpMethod ?? "").trim(), Number(booking.dpAmount ?? 0));
    addAmount(String(booking.fpMethod ?? "").trim(), Number(booking.fpAmount ?? 0));
  } else {
    // Only show payments received by selected receiver
    const selected = selectedReceiver.toUpperCase();
    const dpReceiver = String(booking.dpReceivedBy ?? "").trim().toUpperCase();
    const fpReceiver = String(booking.fpReceivedBy ?? "").trim().toUpperCase();

    const addAmount = (method: string, amount: number) => {
      const safeAmount = Math.max(0, amount);
      if (!safeAmount) return;

      const methodLower = method.toLowerCase();
      if (methodLower === "cash") amounts.Cash += safeAmount;
      else if (methodLower === "gcash") amounts.GCash += safeAmount;
      else if (methodLower === "bank transfer") amounts["Bank Transfer"] += safeAmount;
    };

    if (dpReceiver === selected) {
      addAmount(String(booking.dpMethod ?? "").trim(), Number(booking.dpAmount ?? 0));
    }

    if (fpReceiver === selected) {
      addAmount(String(booking.fpMethod ?? "").trim(), Number(booking.fpAmount ?? 0));
    }
  }

  return amounts;
}

function buildWeeklyReport(
  sourceBookings: Booking[],
  weekStart: string,
  weekEnd: string,
  selectedReceiver: string
): WeeklyReport {
  const rows = Array.from({ length: 7 }, (_, index) => {
    const dayKey = addDays(weekStart, index);
    const dayBookings = sourceBookings.filter((b) => (b.checkInDateKey || toYMD(b.checkIn)) === dayKey);
    const dayRelevantBookings = dayBookings.filter((b) => bookingMatchesReceiver(b, selectedReceiver));

    const bySource = SOURCE_ORDER.reduce((acc, source) => {
      acc[source] = 0;
      return acc;
    }, {} as Record<SourceName, number>);

    dayRelevantBookings.forEach((b) => {
      const source = String(b.bookingPlatform || "Direct").trim() as SourceName;
      bySource[source] += 1;
    });

    const methodTotals = METHOD_ORDER.reduce((acc, method) => {
      acc[method] = 0;
      return acc;
    }, {} as Record<MethodName, number>);

    dayRelevantBookings.forEach((b) => {
      const amounts = getMethodAmountsForReceiver(b, selectedReceiver);
      METHOD_ORDER.forEach((method) => {
        methodTotals[method] += amounts[method];
      });
    });

    const paidTotal = METHOD_ORDER.reduce((sum, method) => sum + methodTotals[method], 0);

    return {
      dayKey,
      label: new Date(`${dayKey}T12:00:00`).toLocaleDateString("en-PH", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      bookings: dayRelevantBookings.length,
      bySource,
      methods: methodTotals,
      paidTotal,
      guestList: dayRelevantBookings.map((b) => ({
        id: b.id,
        guestName: b.guestName,
        unit: b.unit,
        bookingSource: b.bookingSource,
        totalFee: b.totalFee,
        dpAmount: b.dpAmount || 0,
        fpAmount: b.fpAmount || 0,
        dpReceivedBy: b.dpReceivedBy,
        fpReceivedBy: b.fpReceivedBy,
      })),
    };
  });

  const totals = SOURCE_ORDER.reduce((acc, source) => {
    acc[source] = {
      bookings: 0,
      methods: {
        Cash: 0,
        GCash: 0,
        "Bank Transfer": 0,
      },
    };
    return acc;
  }, {} as Record<SourceName, { bookings: number; methods: Record<MethodName, number> }>);

  const methodTotals = METHOD_ORDER.reduce((acc, method) => {
    acc[method] = 0;
    return acc;
  }, {} as Record<MethodName, number>);

  const weekBookings = sourceBookings.filter((b) => {
    const key = b.checkInDateKey || toYMD(b.checkIn);
    return key >= weekStart && key <= weekEnd;
  });

  const weekRelevantBookings = weekBookings.filter((b) => bookingMatchesReceiver(b, selectedReceiver));

  weekRelevantBookings.forEach((b) => {
    const source = String(b.bookingPlatform || "Direct").trim() as SourceName;
    const amounts = getMethodAmountsForReceiver(b, selectedReceiver);
    totals[source].bookings += 1;
    METHOD_ORDER.forEach((method) => {
      totals[source].methods[method] += amounts[method];
      methodTotals[method] += amounts[method];
    });
  });

  const totalPaid = METHOD_ORDER.reduce((sum, method) => sum + methodTotals[method], 0);

  return {
    rows,
    summary: {
      totals,
      methodTotals,
      totalBookings: weekRelevantBookings.length,
      totalPaid,
    },
  };
}

export default function SourceReportPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyDate, setWeeklyDate] = useState(() => toYMD(new Date()));
  const [selectedReceiver, setSelectedReceiver] = useState<string>("__all__");
  const [weeklyManualExpenses, setWeeklyManualExpenses] = useState<ManualExpenseEntry[]>([]);
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseComment, setNewExpenseComment] = useState("");

  useEffect(() => {
    fetch("/api/bookings?view=all", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setBookings(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const week = useMemo(() => getSundayToSaturdayWeek(weeklyDate), [weeklyDate]);

  const receivers = useMemo(() => {
    const dpReceivers = bookings.map((b) => b.dpReceivedBy);
    const fpReceivers = bookings.map((b) => b.fpReceivedBy);
    const all = [...dpReceivers, ...fpReceivers];
    return Array.from(
      new Set(
        all
          .map((v) => String(v ?? "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [bookings]);

  // Fetch manual expenses whenever week changes (always fetch all for now)
  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        // Always fetch all expenses for the week, regardless of receiver filter
        const url = `/api/manual-expenses/week?weekStart=${week.startDate}&weekEnd=${week.endDate}`;
        console.log("Fetching expenses from:", url);
        const response = await fetch(url, { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          console.log("Fetched expenses:", data);
          setWeeklyManualExpenses(data);
        } else {
          const errorText = await response.text();
          console.error("Failed to fetch expenses:", errorText);
          setWeeklyManualExpenses([]);
        }
      } catch (error) {
        console.error("Error fetching manual expenses:", error);
        setWeeklyManualExpenses([]);
      }
    };

    fetchExpenses();
  }, [week.startDate, week.endDate]);

  const coreBookings = useMemo(
    () => bookings.filter((b) => CORE_UNITS.has(String(b.unit ?? "").replace(/^Unit\s*/i, "").trim())),
    [bookings]
  );

  const coreReport = useMemo(
    () => buildWeeklyReport(coreBookings, week.startDate, week.endDate, selectedReceiver),
    [coreBookings, selectedReceiver, week.endDate, week.startDate]
  );

  const weeklyManualExpenseTotal = weeklyManualExpenses
    .filter((entry) => {
      // Filter expenses by selected receiver
      if (selectedReceiver === "__all__") return true;
      return entry.receiver === selectedReceiver || entry.receiver === "__all__";
    })
    .reduce(
      (sum, entry) => sum + Math.max(0, Number(entry.amount ?? 0)),
      0
    );
  
  const adjustedCoreTotalPaid = Math.max(0, coreReport.summary.totalPaid - weeklyManualExpenseTotal);
  const selectedWeekLabel = `${new Date(`${week.startDate}T12:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} to ${new Date(`${week.endDate}T12:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  const shiftWeek = (days: number) => {
    const base = new Date(`${weeklyDate}T12:00:00`);
    if (Number.isNaN(base.getTime())) return;
    base.setDate(base.getDate() + days);
    setWeeklyDate(toYMD(base));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Weekly Source Report</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Sunday to Saturday source counts and payment-method records</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="input text-xs w-auto"
            value={selectedReceiver}
            onChange={(e) => setSelectedReceiver(e.target.value)}
            title="Filter by payment receiver"
          >
            <option value="__all__">All receivers</option>
            {receivers.map((receiver) => (
              <option key={receiver} value={receiver}>{receiver}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => shiftWeek(-7)}
            className="btn-secondary text-xs py-1.5"
          >
            <ChevronLeft className="w-4 h-4" /> Prev Week
          </button>
          <input
            type="date"
            className="input text-xs w-auto"
            value={weeklyDate}
            onChange={(e) => setWeeklyDate(e.target.value || toYMD(new Date()))}
          />
          <button
            type="button"
            onClick={() => shiftWeek(7)}
            className="btn-secondary text-xs py-1.5"
          >
            Next Week <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Core units (1116, 1118, 1558, 1845)
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
            {new Date(`${week.startDate}T12:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}
            {" "}to{" "}
            {new Date(`${week.endDate}T12:00:00`).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium inline-flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" />
              {coreReport.summary.totalBookings} bookings
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium inline-flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" />
              {formatPHP(coreReport.summary.totalPaid)} Total paid
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {SOURCE_ORDER.map((source) => (
            <div key={source} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{source}</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{coreReport.summary.totals[source].bookings}</p>
              <div className="mt-1 space-y-0.5 text-[11px]">
                <p className="text-gray-600">Cash {formatPHP(coreReport.summary.totals[source].methods.Cash)}</p>
                <p className="text-green-700 font-medium">GCash {formatPHP(coreReport.summary.totals[source].methods.GCash)}</p>
                <p className="text-blue-700">Bank {formatPHP(coreReport.summary.totals[source].methods["Bank Transfer"])}</p>
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-800 uppercase tracking-wide">Adjusted Paid</p>
            <p className="text-lg font-bold text-amber-900 mt-0.5">{formatPHP(adjustedCoreTotalPaid)}</p>
            <p className="text-xs text-amber-700 mt-1">Local minus</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Cash</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{formatPHP(coreReport.summary.methodTotals.Cash)}</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-xs text-green-700 uppercase tracking-wide">GCash</p>
            <p className="text-lg font-bold text-green-800 mt-0.5">{formatPHP(coreReport.summary.methodTotals.GCash)}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-700 uppercase tracking-wide">Bank Transfer</p>
            <p className="text-lg font-bold text-blue-800 mt-0.5">{formatPHP(coreReport.summary.methodTotals["Bank Transfer"])}</p>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
            <p className="text-xs text-purple-700 uppercase tracking-wide">Total Paid</p>
            <p className="text-lg font-bold text-purple-800 mt-0.5">{formatPHP(coreReport.summary.totalPaid)}</p>
          </div>
        </div>

        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-800 font-semibold uppercase tracking-wide">Manual Weekly Expenses (direct minus)</p>
          <p className="mt-0.5 text-[11px] text-amber-700">Deducted for week: {selectedWeekLabel}</p>

          <div className="mt-2 grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-2">
            <input
              type="text"
              inputMode="decimal"
              className="input"
              placeholder="Amount"
              value={newExpenseAmount}
              onChange={(e) => setNewExpenseAmount(e.target.value)}
            />
            <input
              type="text"
              className="input"
              placeholder="Comment (example: electricity, water, snacks)"
              value={newExpenseComment}
              onChange={(e) => setNewExpenseComment(e.target.value)}
            />
            <button
              type="button"
              className="btn-secondary text-xs py-1.5 px-3"
              onClick={async () => {
                const amount = parseManualAmount(newExpenseAmount);
                const comment = newExpenseComment.trim();
                if (!amount || !comment) return;

                try {
                  const response = await fetch("/api/manual-expenses", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      weekStart: week.startDate,
                      weekEnd: week.endDate,
                      receiver: selectedReceiver,
                      amount,
                      comment,
                    }),
                  });

                  if (response.ok) {
                    const newExpense = await response.json();
                    setWeeklyManualExpenses((prev) => [...prev, newExpense]);
                    setNewExpenseAmount("");
                    setNewExpenseComment("");
                  } else {
                    const errorData = await response.json();
                    console.error("Failed to add expense:", errorData);
                    alert(`Failed to add expense: ${errorData.error || 'Unknown error'}`);
                  }
                } catch (error) {
                  console.error("Error adding expense:", error);
                  alert(`Error adding expense: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }}
            >
              Add expense
            </button>
          </div>

          <div className="mt-2 text-xs sm:text-sm text-amber-900 space-y-0.5">
            <p>Manual expenses total: <span className="font-semibold">{formatPHP(weeklyManualExpenseTotal)}</span></p>
            <p>Adjusted total paid: <span className="font-semibold">{formatPHP(adjustedCoreTotalPaid)}</span></p>
            <p className="text-[11px] text-amber-700">Local report-only minus. This does not sync to Finances.</p>
          </div>

          {weeklyManualExpenses.length > 0 ? (
            <div className="mt-2 rounded-md border border-amber-100 bg-white overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-amber-50 text-amber-900">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-semibold">Week</th>
                    <th className="text-left px-2 py-1.5 font-semibold">Comment</th>
                    <th className="text-right px-2 py-1.5 font-semibold">Amount</th>
                    <th className="text-right px-2 py-1.5 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyManualExpenses.map((entry) => (
                    <tr key={entry.id} className="border-t border-amber-100">
                      <td className="px-2 py-1.5 text-amber-800 whitespace-nowrap">{selectedWeekLabel}</td>
                      <td className="px-2 py-1.5 text-amber-900">{entry.comment}</td>
                      <td className="px-2 py-1.5 text-right font-medium text-amber-900">-{formatPHP(entry.amount)}</td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          className="text-[11px] text-red-600 hover:text-red-700"
                          onClick={async () => {
                            try {
                              const response = await fetch(
                                `/api/manual-expenses?id=${entry.id}`,
                                { method: "DELETE" }
                              );

                              if (response.ok) {
                                setWeeklyManualExpenses((prev) =>
                                  prev.filter((item) => item.id !== entry.id)
                                );
                              }
                            } catch (error) {
                              console.error("Error removing expense:", error);
                            }
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Day</th>
                <th className="text-right px-3 py-2 font-semibold">Total</th>
                <th className="text-right px-3 py-2 font-semibold">Direct</th>
                <th className="text-right px-3 py-2 font-semibold">TikTok</th>
                <th className="text-right px-3 py-2 font-semibold">Facebook</th>
                <th className="text-right px-3 py-2 font-semibold">Airbnb</th>
                <th className="text-right px-3 py-2 font-semibold">Cash</th>
                <th className="text-right px-3 py-2 font-semibold">GCash</th>
                <th className="text-right px-3 py-2 font-semibold">Bank</th>
                <th className="text-right px-3 py-2 font-semibold">Paid Total</th>
              </tr>
            </thead>
            <tbody>
              {coreReport.rows.map((row) => (
                <tr key={row.dayKey} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium text-gray-800">{row.label}</td>
                  <td className="px-3 py-2 text-right">{row.bookings}</td>
                  <td className="px-3 py-2 text-right">{row.bySource.Direct}</td>
                  <td className="px-3 py-2 text-right">{row.bySource.TikTok}</td>
                  <td className="px-3 py-2 text-right">{row.bySource.Facebook}</td>
                  <td className="px-3 py-2 text-right">{row.bySource.Airbnb}</td>
                  <td className="px-3 py-2 text-right">{formatPHP(row.methods.Cash)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-green-700">{formatPHP(row.methods.GCash)}</td>
                  <td className="px-3 py-2 text-right text-blue-700">{formatPHP(row.methods["Bank Transfer"])}</td>
                  <td className="px-3 py-2 text-right font-semibold text-purple-700">{formatPHP(row.paidTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-900">
                <td className="px-3 py-2">Week total</td>
                <td className="px-3 py-2 text-right">{coreReport.summary.totalBookings}</td>
                <td className="px-3 py-2 text-right">{coreReport.summary.totals.Direct.bookings}</td>
                <td className="px-3 py-2 text-right">{coreReport.summary.totals.TikTok.bookings}</td>
                <td className="px-3 py-2 text-right">{coreReport.summary.totals.Facebook.bookings}</td>
                <td className="px-3 py-2 text-right">{coreReport.summary.totals.Airbnb.bookings}</td>
                <td className="px-3 py-2 text-right">{formatPHP(coreReport.summary.methodTotals.Cash)}</td>
                <td className="px-3 py-2 text-right text-green-700">{formatPHP(coreReport.summary.methodTotals.GCash)}</td>
                <td className="px-3 py-2 text-right text-blue-700">{formatPHP(coreReport.summary.methodTotals["Bank Transfer"])}</td>
                <td className="px-3 py-2 text-right text-purple-700">{formatPHP(coreReport.summary.totalPaid)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Guest Details Table */}
      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Guest Details by Day</h2>
              <p className="text-xs text-gray-500 mt-1">Check-in schedule with booking manager and payment receiver</p>
            </div>
            <div className="flex flex-col gap-2 sticky top-4 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Legend:</span>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center text-[10px] px-2.5 py-1.5 rounded-md bg-purple-600 text-white border border-purple-700 font-bold min-w-[70px]">
                  BOOKED BY
                </span>
                <span className="text-xs text-gray-500">=</span>
                <span className="text-xs text-gray-600">Who Got Booking</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center text-[10px] px-2.5 py-1.5 rounded-md bg-green-500 text-white border border-green-600 font-bold min-w-[70px]">
                  DP PAID TO
                </span>
                <span className="text-xs text-gray-500">=</span>
                <span className="text-xs text-gray-600">Deposit Receiver</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center text-[10px] px-2.5 py-1.5 rounded-md bg-blue-500 text-white border border-blue-600 font-bold min-w-[70px]">
                  FP PAID TO
                </span>
                <span className="text-xs text-gray-500">=</span>
                <span className="text-xs text-gray-600">Full Payment Receiver</span>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100 text-xs text-gray-700 uppercase tracking-wide border-b-2 border-gray-300">
              <tr>
                <th className="px-3 py-2.5 text-left font-bold border-r border-gray-300">Day</th>
                <th className="px-3 py-2.5 text-center font-bold border-r border-gray-300">Total</th>
                <th className="px-3 py-2.5 text-left font-bold border-r border-gray-300">Guest Name</th>
                <th className="px-3 py-2.5 text-center font-bold border-r border-gray-300">Unit</th>
                <th className="px-3 py-2.5 text-center font-bold border-r border-gray-300">Booked By</th>
                <th className="px-3 py-2.5 text-center font-bold border-r border-gray-300">DP Paid To</th>
                <th className="px-3 py-2.5 text-right font-bold border-r border-gray-300">DP Amount</th>
                <th className="px-3 py-2.5 text-center font-bold border-r border-gray-300">FP Paid To</th>
                <th className="px-3 py-2.5 text-right font-bold border-r border-gray-300">FP Amount</th>
                <th className="px-3 py-2.5 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {coreReport.rows.map((row) => {
                const dateLabel = new Date(row.dayKey).toLocaleDateString("en-PH", { 
                  month: "short", 
                  day: "numeric" 
                });
                const guestList = row.guestList || [];
                
                if (guestList.length === 0) {
                  return (
                    <tr key={row.dayKey} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-3 border-r border-gray-200">
                        <div className="font-semibold text-gray-900">{row.label.split(',')[0]}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{dateLabel}</div>
                      </td>
                      <td className="px-3 py-3 text-center border-r border-gray-200">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-gray-100 text-gray-400">
                          0
                        </span>
                      </td>
                      <td colSpan={8} className="px-3 py-3 text-center text-xs text-gray-400 italic">
                        No guests scheduled
                      </td>
                    </tr>
                  );
                }
                
                return guestList.map((guest, index) => {
                  const bookedBy = guest.bookingSource || "Unknown";
                  const dpReceiver = guest.dpReceivedBy || "None";
                  const fpReceiver = guest.fpReceivedBy || "None";
                  
                  const bookedByColors: Record<string, string> = {
                    "riemar": "bg-purple-600 text-white",
                    "sir james": "bg-indigo-600 text-white",
                    "sir mike": "bg-cyan-600 text-white",
                    "jayjay": "bg-orange-600 text-white",
                    "none": "bg-gray-500 text-white",
                  };
                  
                  const receiverColors: Record<string, string> = {
                    "riemar": "bg-purple-400 text-white",
                    "sir james": "bg-indigo-400 text-white",
                    "sir mike": "bg-cyan-400 text-white",
                    "jayjay": "bg-orange-400 text-white",
                    "none": "bg-gray-400 text-white",
                  };
                  
                  const normalizedBookedBy = bookedBy.toLowerCase().trim();
                  const normalizedDpReceiver = dpReceiver.toLowerCase().trim();
                  const normalizedFpReceiver = fpReceiver.toLowerCase().trim();
                  const bookedByColor = bookedByColors[normalizedBookedBy] || "bg-gray-700 text-white";
                  const dpReceiverColor = receiverColors[normalizedDpReceiver] || "bg-gray-500 text-white";
                  const fpReceiverColor = receiverColors[normalizedFpReceiver] || "bg-gray-500 text-white";
                  
                  return (
                    <tr key={`${row.dayKey}-${guest.id}`} className="border-b border-gray-200 hover:bg-gray-50">
                      {index === 0 ? (
                        <>
                          <td rowSpan={guestList.length} className="px-3 py-3 border-r border-gray-200 align-top bg-gray-50">
                            <div className="font-semibold text-gray-900">{row.label.split(',')[0]}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{dateLabel}</div>
                          </td>
                          <td rowSpan={guestList.length} className="px-3 py-3 text-center border-r border-gray-200 align-top bg-gray-50">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm">
                              {row.bookings}
                            </span>
                          </td>
                        </>
                      ) : null}
                      <td className="px-3 py-2.5 border-r border-gray-200">
                        <span className="text-gray-900 font-medium">{guest.guestName}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center border-r border-gray-200">
                        <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">{guest.unit}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center border-r border-gray-200">
                        <span 
                          className={`text-[10px] px-2.5 py-1.5 rounded-md font-bold ${bookedByColor} shadow-sm uppercase whitespace-nowrap inline-block min-w-[70px]`}
                          title={`Booked by ${bookedBy}`}
                        >
                          {bookedBy}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center border-r border-gray-200">
                        <span 
                          className={`text-[10px] px-2.5 py-1.5 rounded-md font-bold ${dpReceiverColor} shadow-sm uppercase whitespace-nowrap inline-block min-w-[70px]`}
                          title={`Deposit received by ${dpReceiver}`}
                        >
                          {dpReceiver}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right border-r border-gray-200">
                        <span className="font-semibold text-green-700">{formatPHP(guest.dpAmount)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center border-r border-gray-200">
                        <span 
                          className={`text-[10px] px-2.5 py-1.5 rounded-md font-bold ${fpReceiverColor} shadow-sm uppercase whitespace-nowrap inline-block min-w-[70px]`}
                          title={`Full payment received by ${fpReceiver}`}
                        >
                          {fpReceiver}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right border-r border-gray-200">
                        <span className="font-semibold text-blue-700">{formatPHP(guest.fpAmount)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="font-bold text-purple-700">{formatPHP(guest.dpAmount + guest.fpAmount)}</span>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
            <tfoot className="bg-gradient-to-r from-gray-100 to-gray-200 border-t-2 border-gray-300">
              <tr>
                <td className="px-3 py-3 font-bold text-gray-900 border-r border-gray-300">Week Total</td>
                <td className="px-3 py-3 text-center border-r border-gray-300">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md">
                    {coreReport.summary.totalBookings}
                  </span>
                </td>
                <td colSpan={4} className="px-3 py-3 text-gray-700 font-medium border-r border-gray-300">
                  {coreReport.summary.totalBookings} total guest{coreReport.summary.totalBookings !== 1 ? 's' : ''}
                </td>
                <td className="px-3 py-3 text-right font-bold text-green-700 border-r border-gray-300">
                  {formatPHP(coreReport.rows.reduce((sum, row) => 
                    sum + row.guestList.reduce((guestSum, guest) => guestSum + guest.dpAmount, 0), 0
                  ))}
                </td>
                <td className="px-3 py-3 border-r border-gray-300"></td>
                <td className="px-3 py-3 text-right font-bold text-blue-700 border-r border-gray-300">
                  {formatPHP(coreReport.rows.reduce((sum, row) => 
                    sum + row.guestList.reduce((guestSum, guest) => guestSum + guest.fpAmount, 0), 0
                  ))}
                </td>
                <td className="px-3 py-3 text-right font-bold text-purple-700 text-base">
                  {formatPHP(coreReport.summary.totalPaid)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}