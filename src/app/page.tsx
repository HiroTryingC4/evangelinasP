"use client";
import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { TrendingUp, Users, BookOpen, AlertTriangle, CheckCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatPHP, formatDate, formatWeekRange, UNITS } from "@/lib/utils";
import { subscribeBookingsChanged } from "@/lib/bookings-sync";

const UNIT_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6"];

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [units, setUnits] = useState<string[]>(UNITS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(`${new Date().getFullYear()}-12-31`);
  const [weeklyDate, setWeeklyDate] = useState(() => toYMD(new Date()));
  const [selectedWeeklyUnits, setSelectedWeeklyUnits] = useState<string[]>([]);
  const [selectedMonthlyUnits, setSelectedMonthlyUnits] = useState<string[]>([]);
  const [weeklyMetric, setWeeklyMetric] = useState<"revenue" | "guests">("revenue");
  const [monthlyView, setMonthlyView] = useState<"incoming-waiting" | "total" | "collected">("incoming-waiting");

  const fetchDashboard = async () => {
    const isInitialLoad = !data;
    if (isInitialLoad) setLoading(true);
    else setRefreshing(true);

    const params = new URLSearchParams({ from, to });
    params.set("weeklyDate", weeklyDate);
    if (selectedWeeklyUnits.length > 0) params.set("weeklyUnits", selectedWeeklyUnits.join(","));
    if (selectedMonthlyUnits.length > 0) params.set("monthlyUnits", selectedMonthlyUnits.join(","));
    params.set("_ts", Date.now().toString());
    try {
      const res = await fetch(`/api/dashboard?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Dashboard API ${res.status}`);
      const json = await res.json();
      setData(json);
      setError("");
    } catch {
      setError("Failed to load dashboard data. Please refresh.");
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, [from, to, weeklyDate, selectedWeeklyUnits, selectedMonthlyUnits]);

  useEffect(() => {
    return subscribeBookingsChanged(() => {
      fetchDashboard();
    });
  }, [from, to, weeklyDate, selectedWeeklyUnits, selectedMonthlyUnits]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.units) && d.units.length > 0) setUnits(d.units);
      })
      .catch(() => {});
  }, []);

  const shiftWeek = (days: number) => {
    const base = new Date(`${weeklyDate}T12:00:00`);
    if (Number.isNaN(base.getTime())) return;
    base.setDate(base.getDate() + days);
    setWeeklyDate(toYMD(base));
  };

  const toggleWeeklyUnit = (unitCode: string) => {
    setSelectedWeeklyUnits((prev) => {
      if (prev.includes(unitCode)) return prev.filter((u) => u !== unitCode);
      return [...prev, unitCode];
    });
  };

  const toggleMonthlyUnit = (unitCode: string) => {
    setSelectedMonthlyUnits((prev) => {
      if (prev.includes(unitCode)) return prev.filter((u) => u !== unitCode);
      return [...prev, unitCode];
    });
  };

  const monthlyChartData = useMemo(() => {
    const source = data?.monthlyRevenue ?? [];
    return source.map((row: any) => {
      const totalRevenue = Number(row.revenue ?? 0);
      const unit1245Revenue = Number(row.unit1245Revenue ?? 0);
      const unit1245IncomingPayment = Number(row.unit1245IncomingPayment ?? 0);
      const unit1245WaitingPayment = Number(row.unit1245WaitingPayment ?? 0);
      const otherUnitsRevenue = Number(row.otherUnitsRevenue ?? Math.max(0, totalRevenue - unit1245Revenue));
      const incomingPayment = Number(row.incomingPayment ?? 0);
      const waitingPayment = Number(row.waitingPayment ?? 0);
      const collectedPayment = Math.max(0, totalRevenue - waitingPayment);

      return {
        ...row,
        unit1245Revenue,
        unit1245IncomingPayment,
        unit1245WaitingPayment,
        otherUnitsRevenue,
        incomingPayment,
        waitingPayment,
        collectedPayment,
        chartValue:
          monthlyView === "total"
            ? totalRevenue
            : monthlyView === "collected"
              ? collectedPayment
              : incomingPayment,
      };
    });
  }, [data?.monthlyRevenue, monthlyView]);

  if (loading && !data) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">{error || "No data available"}</div>
    </div>
  );

  const {
    summary,
    revenuePerUnit,
    revenuePerSource,
    monthlyRevenue,
    outstanding,
    today: todayData,
    weekly: weeklyRaw,
    weeklyAnalysis: weeklyAnalysisRaw,
  } = data;

  const weekly = weeklyRaw ?? {
    revenue: 0,
    guests: 0,
    perUnit: [] as any[],
    startDate: toYMD(new Date()),
    endDate: toYMD(new Date()),
  };

  const weeklyAnalysis = weeklyAnalysisRaw ?? {
    label: "All Units",
    revenue: 0,
    guests: 0,
    startDate: weekly.startDate,
    endDate: weekly.endDate,
    days: [] as any[],
  };

  const weekRevenueDisplay = weeklyAnalysis?.revenue ?? weekly?.revenue ?? 0;
  const weekGuestsDisplay = weeklyAnalysis?.guests ?? weekly?.guests ?? 0;
  const weekScopeLabel = weeklyAnalysis?.label ?? "All Units";

  const monthlyViewLabel =
    monthlyView === "total"
      ? "Total revenue"
      : monthlyView === "collected"
        ? "Collected only"
        : "Incoming vs waiting";

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Revenue & booking analytics</p>
        </div>
        <div className="flex items-center gap-2">
          {refreshing && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mr-1">
              <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-600" />
              Updating...
            </div>
          )}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto text-xs" />
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-auto text-xs" />
        </div>
      </div>

      {/* QUICK links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/tomorrow" className="card p-4 hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Guests Summary</span>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900">{todayData?.count ?? 0}</div>
          <div className="text-xs text-gray-400 mt-1">view schedule details</div>
        </Link>
        <Link href="/finances" className="card p-4 hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Week Revenue</span>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-blue-700">{formatPHP(weekRevenueDisplay)}</div>
          <div className="text-xs text-gray-400 mt-1">{weekGuestsDisplay} guests this week ({weekScopeLabel})</div>
        </Link>
        <Link href="/payments" className="card p-4 hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payments</span>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900">{formatPHP(summary.collectedRevenue ?? 0)}</div>
          <div className="text-xs text-gray-400 mt-1">Go to payment records</div>
        </Link>
      </div>

      {/* Main summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-1.5 text-blue-600 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-semibold text-gray-500">Expected Revenue</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatPHP(summary.expectedRevenue ?? summary.totalRevenue)}</p>
          <p className="text-[11px] text-gray-400 mt-1">Projected from booked stays</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-semibold text-gray-500">Collected Revenue</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatPHP(summary.collectedRevenue ?? summary.activeRevenue ?? 0)}</p>
          <p className="text-[11px] text-gray-400 mt-1">Down payments + full payments received</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-1.5 text-indigo-600 mb-1">
            <BookOpen className="w-4 h-4" />
            <span className="text-xs font-semibold text-gray-500">Bookings</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.totalBookings}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-1.5 text-purple-600 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs font-semibold text-gray-500">Avg/Booking</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatPHP(Math.round(summary.avgPerBooking))}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-1.5 text-green-600 mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-semibold text-gray-500">Fully Paid</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{summary.fullyPaid}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-1.5 text-yellow-600 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-semibold text-gray-500">Follow-Ups</span>
          </div>
          <p className="text-2xl font-bold text-yellow-700">{summary.followUps}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-1.5 text-red-600 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-semibold text-gray-500">Conflicts</span>
          </div>
          <p className="text-2xl font-bold text-red-700">{summary.conflicts}</p>
        </div>
      </div>

      {/* Payment status bar */}
      <div className="card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Payment Status</h2>
        {summary.totalBookings > 0 ? (
          <>
            <div className="flex rounded-full overflow-hidden h-4 sm:h-5 text-xs">
              {summary.fullyPaid > 0 && (
                <div className="bg-green-500 flex items-center justify-center text-white font-medium"
                  style={{ width: `${(summary.fullyPaid / summary.totalBookings) * 100}%` }}>
                  {summary.fullyPaid > 2 ? summary.fullyPaid : ""}
                </div>
              )}
              {summary.dpPaid > 0 && (
                <div className="bg-yellow-400 flex items-center justify-center text-yellow-900 font-medium"
                  style={{ width: `${(summary.dpPaid / summary.totalBookings) * 100}%` }}>
                  {summary.dpPaid > 2 ? summary.dpPaid : ""}
                </div>
              )}
              {summary.noDP > 0 && (
                <div className="bg-red-400 flex items-center justify-center text-white font-medium"
                  style={{ width: `${(summary.noDP / summary.totalBookings) * 100}%` }}>
                  {summary.noDP > 2 ? summary.noDP : ""}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Fully Paid: {summary.fullyPaid}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />DP Paid: {summary.dpPaid}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />No DP: {summary.noDP}</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400">No bookings in this date range</p>
        )}
      </div>

      {/* Weekly revenue per unit */}
      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Weekly Revenue per Unit</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatWeekRange(weekly.startDate, weekly.endDate)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-blue-700">{formatPHP(weekly.revenue)}</div>
            <div className="text-xs text-gray-400">{weekly.guests} guests</div>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {weekly.perUnit.map((u: any, i: number) => {
            const maxRev = Math.max(...weekly.perUnit.map((x: any) => x.revenue), 1);
            const pct = Math.round((u.revenue / maxRev) * 100);
            return (
              <div key={u.unitCode} className="px-4 sm:px-5 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: UNIT_COLORS[i] }} />
                    <span className="text-sm font-medium text-gray-800">{u.unit}</span>
                    <span className="text-xs text-gray-400">{u.guests} guest{u.guests !== 1 ? "s" : ""}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{formatPHP(u.revenue)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: UNIT_COLORS[i] }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly analysis (Sun-Sat): multi-unit checkbox scope */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Weekly Analysis (Sun-Sat)</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatWeekRange(weeklyAnalysis.startDate, weeklyAnalysis.endDate)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => shiftWeek(-7)} className="btn-secondary text-xs py-1.5">
              <ChevronLeft className="w-4 h-4" /> Prev Week
            </button>
            <input
              type="date"
              className="input py-1.5 text-xs w-auto"
              value={weeklyDate}
              onChange={(e) => setWeeklyDate(e.target.value)}
            />
            <button type="button" onClick={() => shiftWeek(7)} className="btn-secondary text-xs py-1.5">
              Next Week <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-gray-500">Scope</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
          <label className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedWeeklyUnits.length === 0}
              onChange={() => setSelectedWeeklyUnits([])}
            />
            All Units
          </label>
          {units.map((u) => (
            <label key={u} className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedWeeklyUnits.includes(u)}
                onChange={() => toggleWeeklyUnit(u)}
              />
              Unit {u}
            </label>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => setWeeklyMetric("revenue")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              weeklyMetric === "revenue"
                ? "bg-blue-600 text-white"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100"
            }`}
          >
            Revenue
          </button>
          <button
            type="button"
            onClick={() => setWeeklyMetric("guests")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              weeklyMetric === "guests"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            Guests
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-[11px] uppercase tracking-wide text-blue-700 font-semibold">Revenue ({weeklyAnalysis.label})</p>
            <p className="text-xl font-bold text-blue-800 mt-0.5">{formatPHP(weeklyAnalysis.revenue)}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3">
            <p className="text-[11px] uppercase tracking-wide text-emerald-700 font-semibold">Guests ({weeklyAnalysis.label})</p>
            <p className="text-xl font-bold text-emerald-800 mt-0.5">{weeklyAnalysis.guests}</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weeklyAnalysis.days} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v) =>
                weeklyMetric === "revenue" ? `${(v / 1000).toFixed(0)}k` : `${v}`
              }
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const day = payload[0]?.payload;
                const dateLabel = day?.date
                  ? new Date(day.date).toLocaleDateString("en-PH", { month: "short", day: "numeric" })
                  : "";

                return (
                  <div className="rounded border border-gray-200 bg-white px-3 py-2 shadow-sm">
                    <p className="text-sm font-medium text-gray-900">
                      {label}{dateLabel ? ` (${dateLabel})` : ""}
                    </p>
                    <p className="text-sm text-blue-600">revenue : {formatPHP(day?.revenue ?? 0)}</p>
                    <p className="text-sm text-emerald-600">guests : {day?.guests ?? 0}</p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey={weeklyMetric}
              fill={weeklyMetric === "revenue" ? "#3b82f6" : "#059669"}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Charts — stacked on mobile, side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card p-4 sm:p-5">
          <div className="mb-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Monthly Revenue (₱)</h2>
                <p className="text-xs text-gray-400 mt-0.5">Grouped by check-in month</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setMonthlyView("incoming-waiting")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${monthlyView === "incoming-waiting" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}
                >
                  Incoming / Waiting
                </button>
                <button
                  type="button"
                  onClick={() => setMonthlyView("total")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${monthlyView === "total" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}
                >
                  Total
                </button>
                <button
                  type="button"
                  onClick={() => setMonthlyView("collected")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${monthlyView === "collected" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}
                >
                  Collected only
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 mt-3 mb-2">
              <label className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedMonthlyUnits.length === 0}
                  onChange={() => setSelectedMonthlyUnits([])}
                />
                All Units
              </label>
              {units.map((u) => (
                <label key={`monthly-${u}`} className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedMonthlyUnits.includes(u)}
                    onChange={() => toggleMonthlyUnit(u)}
                  />
                  Unit {u}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">View: {monthlyViewLabel}</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyChartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number, name: string, props: any) => {
                  if (name === "incomingPayment") return [formatPHP(value), "Incoming payment"];
                  if (name === "waitingPayment") return [formatPHP(value), "Waiting payment"];
                  if (name === "collectedPayment") return [formatPHP(value), "Collected payment"];
                  if (name === "chartValue") return [formatPHP(value), monthlyViewLabel];
                  return [formatPHP(value), name];
                }}
                labelFormatter={(label) => `Month: ${label}`}
              />
              {monthlyView === "incoming-waiting" ? (
                <>
                  <Legend />
                  <Bar dataKey="incomingPayment" name="Incoming payment" stackId="monthly" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="waitingPayment" name="Waiting payment" stackId="monthly" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </>
              ) : monthlyView === "total" ? (
                <Bar dataKey="chartValue" name="Total revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              ) : (
                <Bar dataKey="chartValue" name="Collected payment" fill="#10b981" radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Revenue per Unit</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={revenuePerUnit} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="unit" tick={{ fontSize: 9 }} tickFormatter={(v) => v.replace("Unit ", "")} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatPHP(v)} />
              <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                {revenuePerUnit.map((_: any, i: number) => <Cell key={i} fill={UNIT_COLORS[i % UNIT_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Monthly Payment Breakdown</h2>
          <p className="text-xs text-gray-400 mt-0.5">Incoming payment and waiting payment by month</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Month</th>
                <th className="px-4 py-3 text-left font-medium">Incoming payment</th>
                <th className="px-4 py-3 text-left font-medium">Waiting payment</th>
                <th className="px-4 py-3 text-left font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Bookings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {monthlyRevenue.map((row: any) => (
                <tr key={row.month} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.month}</td>
                  <td className="px-4 py-3 text-blue-700 font-semibold">{formatPHP(row.incomingPayment ?? 0)}</td>
                  <td className="px-4 py-3 text-amber-700 font-semibold">{formatPHP(row.waitingPayment ?? 0)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{formatPHP(row.revenue ?? 0)}</td>
                  <td className="px-4 py-3 text-gray-600">{row.bookings ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-unit analytics table — scrollable on mobile */}
      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Per-Unit Analytics</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                {["Unit", "Revenue", "Guests", "Fully Paid", "DP Paid", "No DP"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {revenuePerUnit.map((row: any, i: number) => (
                <tr key={row.unit} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: UNIT_COLORS[i] }} />
                      {row.unit}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-blue-700">{formatPHP(row.revenue)}</td>
                  <td className="px-4 py-3">{row.guests}</td>
                  <td className="px-4 py-3 text-green-700">{row.fullyPaid}</td>
                  <td className="px-4 py-3 text-yellow-700">{row.dpPaid}</td>
                  <td className="px-4 py-3 text-red-700">{row.noDP}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold text-xs border-t-2 border-gray-200">
                <td className="px-4 py-3">TOTAL</td>
                <td className="px-4 py-3 text-blue-700">{formatPHP(summary.totalRevenue)}</td>
                <td className="px-4 py-3">{summary.totalBookings}</td>
                <td className="px-4 py-3 text-green-700">{summary.fullyPaid}</td>
                <td className="px-4 py-3 text-yellow-700">{summary.dpPaid}</td>
                <td className="px-4 py-3 text-red-700">{summary.noDP}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Outstanding balances */}
      {outstanding.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-600" />
            <h2 className="text-sm font-semibold text-gray-700">Outstanding Balances ({outstanding.length})</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {outstanding.map((b: any) => {
              const source = String(b.bookingSource || "").trim().toLowerCase();
              const sourceLabel = source === "tiktok" ? "TikTok" : source === "airbnb" ? "Airbnb" : source === "facebook" ? "Facebook" : source === "direct" ? "Direct" : "";
              const sourceBadgeColor = source === "tiktok" ? "bg-gray-900 text-white" : source === "airbnb" ? "bg-pink-500 text-white" : source === "facebook" ? "bg-blue-600 text-white" : source === "direct" ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700";
              
              return (
                <div key={b.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{b.guestName}</p>
                      {sourceLabel && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${sourceBadgeColor}`}>
                          {sourceLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">Unit {b.unit} · {formatDate(b.checkIn)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-red-600">{formatPHP(b.remainingBalance)}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">{b.paymentStatus}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revenue per booking source */}
      {revenuePerSource && revenuePerSource.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Revenue by Booking Source</h2>
            <p className="text-xs text-gray-400 mt-0.5">Total revenue and collected payments per platform</p>
          </div>
          <div className="divide-y divide-gray-50">
            {revenuePerSource.map((s: any) => {
              const maxRev = Math.max(...revenuePerSource.map((x: any) => x.revenue), 1);
              const pct = Math.round((s.revenue / maxRev) * 100);
              const sourceColor = s.source === "TikTok" ? "#1f2937" : s.source === "Airbnb" ? "#ec4899" : s.source === "Facebook" ? "#2563eb" : s.source === "Direct" ? "#059669" : "#6b7280";
              
              return (
                <div key={s.source} className="px-4 sm:px-5 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: sourceColor }} />
                      <span className="text-sm font-medium text-gray-800">{s.source}</span>
                      <span className="text-xs text-gray-400">{s.bookings} booking{s.bookings !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-900">{formatPHP(s.revenue)}</span>
                      <span className="text-xs text-green-600 ml-2">({formatPHP(s.collected)} collected)</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: sourceColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
