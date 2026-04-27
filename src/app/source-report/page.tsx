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
const BELOW_UNITS = new Set(["2208", "2209", "1245"]);
const WEEKLY_MANUAL_EXPENSES_STORAGE_KEY = "source-report:weekly-manual-expenses";
const LEGACY_WEEKLY_MINUS_STORAGE_KEY = "source-report:weekly-minus";

type ManualExpenseEntry = {
  id: string;
  amount: number;
  comment: string;
};

type WeeklyRow = {
  dayKey: string;
  label: string;
  bookings: number;
  bySource: Record<SourceName, number>;
  methods: Record<MethodName, number>;
  paidTotal: number;
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

type ReceiverFilter = "__all__" | string;

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

function normalizeReceiver(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function bookingMatchesReceiver(booking: Booking, selectedReceiver: ReceiverFilter): boolean {
  if (selectedReceiver === "__all__") return true;

  const selected = normalizeReceiver(selectedReceiver);
  const dpReceiver = normalizeReceiver(booking.dpReceivedBy);
  const fpReceiver = normalizeReceiver(booking.fpReceivedBy);

  return dpReceiver === selected || fpReceiver === selected;
}

function getMethodAmountsForReceiver(
  booking: Booking,
  selectedReceiver: ReceiverFilter
): Record<MethodName, number> {
  if (selectedReceiver === "__all__") return getMethodAmounts(booking);

  const selected = normalizeReceiver(selectedReceiver);
  const dpReceiver = normalizeReceiver(booking.dpReceivedBy);
  const fpReceiver = normalizeReceiver(booking.fpReceivedBy);
  const dpIncluded = dpReceiver === selected;
  const fpIncluded = fpReceiver === selected;

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

  if (dpIncluded) addAmount(dpMethod, Number(booking.dpAmount ?? 0));
  if (fpIncluded) addAmount(fpMethod, Number(booking.fpAmount ?? 0));

  return amounts;
}

function buildWeeklyReport(
  sourceBookings: Booking[],
  weekStart: string,
  weekEnd: string,
  selectedReceiver: ReceiverFilter
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
      const source = normalizeBookingSource(b.bookingSource) as SourceName;
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
    const source = normalizeBookingSource(b.bookingSource) as SourceName;
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
  const [selectedReceiver, setSelectedReceiver] = useState<ReceiverFilter>("__all__");
  const [weeklyExpensesByScope, setWeeklyExpensesByScope] = useState<Record<string, ManualExpenseEntry[]>>({});
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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WEEKLY_MANUAL_EXPENSES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, ManualExpenseEntry[]>;
        if (parsed && typeof parsed === "object") {
          setWeeklyExpensesByScope(parsed);
          return;
        }
      }

      // Migrate old one-value weekly minus data to manual expense entries.
      const legacyRaw = window.localStorage.getItem(LEGACY_WEEKLY_MINUS_STORAGE_KEY);
      if (!legacyRaw) return;
      const legacyParsed = JSON.parse(legacyRaw) as Record<string, string>;
      if (!legacyParsed || typeof legacyParsed !== "object") return;

      const migrated: Record<string, ManualExpenseEntry[]> = {};
      Object.entries(legacyParsed).forEach(([scope, amountInput]) => {
        const amount = parseManualAmount(String(amountInput ?? ""));
        if (!amount) return;
        migrated[scope] = [{
          id: `legacy-${scope}`,
          amount,
          comment: "Legacy manual minus",
        }];
      });
      setWeeklyExpensesByScope(migrated);
    } catch {
      setWeeklyExpensesByScope({});
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(WEEKLY_MANUAL_EXPENSES_STORAGE_KEY, JSON.stringify(weeklyExpensesByScope));
    } catch {
      // Ignore storage failures so report rendering never breaks.
    }
  }, [weeklyExpensesByScope]);

  const week = useMemo(() => getSundayToSaturdayWeek(weeklyDate), [weeklyDate]);

  const receivers = useMemo(() => {
    const all = bookings.flatMap((b) => [b.dpReceivedBy, b.fpReceivedBy]);
    return Array.from(
      new Set(
        all
          .map((v) => String(v ?? "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [bookings]);

  const coreBookings = useMemo(
    () => bookings.filter((b) => CORE_UNITS.has(String(b.unit ?? "").replace(/^Unit\s*/i, "").trim())),
    [bookings]
  );

  const otherBookings = useMemo(
    () => bookings.filter((b) => BELOW_UNITS.has(String(b.unit ?? "").replace(/^Unit\s*/i, "").trim())),
    [bookings]
  );

  const coreReport = useMemo(
    () => buildWeeklyReport(coreBookings, week.startDate, week.endDate, selectedReceiver),
    [coreBookings, selectedReceiver, week.endDate, week.startDate]
  );

  const otherReport = useMemo(
    () => buildWeeklyReport(otherBookings, week.startDate, week.endDate, selectedReceiver),
    [otherBookings, selectedReceiver, week.endDate, week.startDate]
  );

  const weeklyExpenseScopeKey = `${week.startDate}:${week.endDate}:${selectedReceiver}`;
  const weeklyManualExpenses = weeklyExpensesByScope[weeklyExpenseScopeKey] ?? [];
  const weeklyManualExpenseTotal = weeklyManualExpenses.reduce((sum, entry) => sum + Math.max(0, Number(entry.amount ?? 0)), 0);
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
            title="Filter report by receiver"
          >
            <option value="__all__">All receivers combined</option>
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
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium inline-flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5" />
                  {formatPHP(coreReport.summary.totalPaid)} Total paid
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-medium inline-flex items-center gap-1">
                  Adjusted {formatPHP(adjustedCoreTotalPaid)}
                </span>
              </div>
            </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-8 gap-2">
          {SOURCE_ORDER.map((source) => (
            <div key={source} className="rounded-lg border border-gray-200 bg-gray-50 p-2">
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">{source}</p>
              <p className="text-base font-bold text-gray-900 mt-0.5">{coreReport.summary.totals[source].bookings}</p>
              <div className="mt-1 space-y-0.5 text-[10px]">
                <p className="text-gray-600">Cash {formatPHP(coreReport.summary.totals[source].methods.Cash)}</p>
                <p className="text-green-700 font-medium">GCash {formatPHP(coreReport.summary.totals[source].methods.GCash)}</p>
                <p className="text-blue-700">Bank {formatPHP(coreReport.summary.totals[source].methods["Bank Transfer"])}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mt-2">
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
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-800 uppercase tracking-wide">Adjusted Paid</p>
            <p className="text-lg font-bold text-amber-900 mt-0.5">{formatPHP(adjustedCoreTotalPaid)}</p>
            <p className="text-xs text-amber-700 mt-1">Local minus</p>
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
              onClick={() => {
                const amount = parseManualAmount(newExpenseAmount);
                const comment = newExpenseComment.trim();
                if (!amount || !comment) return;

                setWeeklyExpensesByScope((prev) => {
                  const current = prev[weeklyExpenseScopeKey] ?? [];
                  const nextEntry: ManualExpenseEntry = {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    amount,
                    comment,
                  };

                  return {
                    ...prev,
                    [weeklyExpenseScopeKey]: [...current, nextEntry],
                  };
                });

                setNewExpenseAmount("");
                setNewExpenseComment("");
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
                          onClick={() => {
                            setWeeklyExpensesByScope((prev) => {
                              const current = prev[weeklyExpenseScopeKey] ?? [];
                              const next = current.filter((item) => item.id !== entry.id);
                              return {
                                ...prev,
                                [weeklyExpenseScopeKey]: next,
                              };
                            });
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

      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Other units record (below core units)</p>
            <p className="text-xs text-gray-500 mt-0.5">Units 2208, 2209, and 1245 only</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium inline-flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" />
              {otherReport.summary.totalBookings} bookings
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium inline-flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" />
              {formatPHP(otherReport.summary.totalPaid)} Total paid
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {SOURCE_ORDER.map((source) => (
            <div key={`other-${source}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{source}</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{otherReport.summary.totals[source].bookings}</p>
              <div className="mt-1 space-y-0.5 text-[11px]">
                <p className="text-gray-600">Cash {formatPHP(otherReport.summary.totals[source].methods.Cash)}</p>
                <p className="text-green-700 font-medium">GCash {formatPHP(otherReport.summary.totals[source].methods.GCash)}</p>
                <p className="text-blue-700">Bank {formatPHP(otherReport.summary.totals[source].methods["Bank Transfer"])}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Cash</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{formatPHP(otherReport.summary.methodTotals.Cash)}</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-xs text-green-700 uppercase tracking-wide">GCash</p>
            <p className="text-lg font-bold text-green-800 mt-0.5">{formatPHP(otherReport.summary.methodTotals.GCash)}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-700 uppercase tracking-wide">Bank Transfer</p>
            <p className="text-lg font-bold text-blue-800 mt-0.5">{formatPHP(otherReport.summary.methodTotals["Bank Transfer"])}</p>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
            <p className="text-xs text-purple-700 uppercase tracking-wide">Total Paid</p>
            <p className="text-lg font-bold text-purple-800 mt-0.5">{formatPHP(otherReport.summary.totalPaid)}</p>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto border border-gray-100 rounded-lg">
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
              {otherReport.rows.map((row) => (
                <tr key={`other-row-${row.dayKey}`} className="border-t border-gray-100">
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
                <td className="px-3 py-2 text-right">{otherReport.summary.totalBookings}</td>
                <td className="px-3 py-2 text-right">{otherReport.summary.totals.Direct.bookings}</td>
                <td className="px-3 py-2 text-right">{otherReport.summary.totals.TikTok.bookings}</td>
                <td className="px-3 py-2 text-right">{otherReport.summary.totals.Facebook.bookings}</td>
                <td className="px-3 py-2 text-right">{otherReport.summary.totals.Airbnb.bookings}</td>
                <td className="px-3 py-2 text-right">{formatPHP(otherReport.summary.methodTotals.Cash)}</td>
                <td className="px-3 py-2 text-right text-green-700">{formatPHP(otherReport.summary.methodTotals.GCash)}</td>
                <td className="px-3 py-2 text-right text-blue-700">{formatPHP(otherReport.summary.methodTotals["Bank Transfer"])}</td>
                <td className="px-3 py-2 text-right text-purple-700">{formatPHP(otherReport.summary.totalPaid)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}