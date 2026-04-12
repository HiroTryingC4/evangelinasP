"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CreditCard, Users, Search, ArrowRight, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { formatPHP, formatDate, STATUS_COLOR, PAYMENT_METHODS } from "@/lib/utils";

type PaymentRecord = {
  id: string;
  bookingId: number;
  guestName: string;
  unit: string;
  paymentType: "DP" | "FP";
  amount: number;
  paymentDate: string | Date | null;
  method: string | null;
  receivedBy: string | null;
  bookingDate: string | Date;
  checkInTime: string;
  checkOutTime: string;
  paymentStatus: string;
  remainingBalance: number;
  dpDate: string | Date | null;
};

export default function PaymentsPage() {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [receiverFilter, setReceiverFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"week" | "all">("week");
  const [search, setSearch] = useState("");
  const [receivers, setReceivers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weeklyDate, setWeeklyDate] = useState(() => toYMD(new Date()));

  function toYMD(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const shiftWeek = (days: number) => {
    const base = new Date(`${weeklyDate}T12:00:00`);
    if (Number.isNaN(base.getTime())) return;
    base.setDate(base.getDate() + days);
    setWeeklyDate(toYMD(base));
  };

  useEffect(() => {
    const isInitialLoad = records.length === 0 && loading;
    if (!isInitialLoad) setRefreshing(true);

    Promise.all([
      fetch(`/api/payments?weeklyDate=${weeklyDate}&scope=${scopeFilter}`).then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ])
      .then(([payments, settings]) => {
        setRecords(Array.isArray(payments.records) ? payments.records : []);
        if (Array.isArray(settings.receivers) && settings.receivers.length > 0) {
          setReceivers(settings.receivers);
        }
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [weeklyDate, scopeFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((record) => {
      if (receiverFilter && record.receivedBy !== receiverFilter) return false;
      if (typeFilter && record.paymentType !== typeFilter) return false;
      if (statusFilter && record.paymentStatus !== statusFilter) return false;
      if (balanceFilter === "with" && record.remainingBalance <= 0) return false;
      if (balanceFilter === "settled" && record.remainingBalance > 0) return false;
      if (!q) return true;
      return (
        record.guestName.toLowerCase().includes(q) ||
        record.unit.toLowerCase().includes(q) ||
        (record.receivedBy ?? "").toLowerCase().includes(q)
      );
    });
  }, [records, receiverFilter, typeFilter, statusFilter, balanceFilter, search]);

  const totals = useMemo(() => {
    const dpCount = filtered.filter((r) => r.paymentType === "DP").length;
    const fpCount = filtered.filter((r) => r.paymentType === "FP").length;
    const totalAmount = filtered.reduce((sum, r) => sum + r.amount, 0);
    const outstandingCount = filtered.filter((r) => r.remainingBalance > 0).length;
    return { dpCount, fpCount, totalAmount, outstandingCount };
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Payment Records</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Track who received each down payment and full payment</p>
        </div>
        <Link href="/settings" className="btn-secondary w-fit">
          <Users className="w-4 h-4" /> Manage receivers
        </Link>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Weekly Payments</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {scopeFilter === "all"
                ? "All payment records"
                : `${new Date(`${weeklyDate}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })} - ${(() => {
                    const base = new Date(`${weeklyDate}T12:00:00`);
                    const start = new Date(base);
                    start.setDate(base.getDate() - base.getDay());
                    const end = new Date(start);
                    end.setDate(start.getDate() + 6);
                    return end.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
                  })()}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => shiftWeek(-7)}
              className="btn-secondary text-xs py-1.5"
              disabled={scopeFilter === "all"}
            >
              <ChevronLeft className="w-4 h-4" /> Prev Week
            </button>
            <input
              type="date"
              className="input py-1.5 text-xs w-auto"
              value={weeklyDate}
              onChange={(e) => setWeeklyDate(e.target.value)}
              disabled={scopeFilter === "all"}
            />
            <button
              type="button"
              onClick={() => shiftWeek(7)}
              className="btn-secondary text-xs py-1.5"
              disabled={scopeFilter === "all"}
            >
              Next Week <ChevronRight className="w-4 h-4" />
            </button>
            {refreshing && (
              <span className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-1.5 text-blue-600 mb-1">
            <CreditCard className="w-4 h-4" />
            <span className="text-xs font-semibold text-gray-500">Records</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
            <CalendarDays className="w-4 h-4" />
            <span className="text-xs font-semibold text-gray-500">Total Amount</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatPHP(totals.totalAmount)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-1.5 text-purple-600 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs font-semibold text-gray-500">With balance</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totals.outstandingCount}</p>
        </div>
      </div>

      <div className="card p-3 sm:p-4 space-y-2 sm:space-y-0 sm:flex sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search guest, unit, receiver..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="DP">Down Payment</option>
            <option value="FP">Full Payment</option>
          </select>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All payment status</option>
            <option value="Fully Paid">Fully Paid</option>
            <option value="DP Paid">DP Paid</option>
            <option value="No DP">No DP</option>
          </select>
          <select className="input" value={balanceFilter} onChange={(e) => setBalanceFilter(e.target.value)}>
            <option value="">All balances</option>
            <option value="with">With balance</option>
            <option value="settled">Fully settled</option>
          </select>
          <select className="input" value={receiverFilter} onChange={(e) => setReceiverFilter(e.target.value)}>
            <option value="">All receivers</option>
            {receivers.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select className="input" value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value as "week" | "all") }>
            <option value="week">This week</option>
            <option value="all">All records</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">No payment records found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((record) => (
            <div key={record.id} className="card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${record.paymentType === "DP" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
                    {record.paymentType === "DP" ? "Down Payment" : "Full Payment"}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">Unit {record.unit}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[record.paymentStatus] ?? "bg-gray-100 text-gray-600"}`}>
                    {record.paymentStatus}
                  </span>
                </div>
                <p className="font-semibold text-gray-900 truncate">{record.guestName}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{formatDate(record.paymentDate)}</span>
                  <span>Deposit paid: {formatDate(record.dpDate)}</span>
                  <span>Method: {record.method ?? "—"}</span>
                  <span>Received by: <span className="font-semibold text-gray-700">{record.receivedBy ?? "—"}</span></span>
                </div>
                <div className="mt-1 text-xs">
                  Balance: <span className={record.remainingBalance > 0 ? "font-semibold text-red-600" : "font-semibold text-green-600"}>{formatPHP(record.remainingBalance)}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-gray-900">{formatPHP(record.amount)}</p>
                <Link href={`/bookings?edit=${record.bookingId}`} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1">
                  View booking <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
