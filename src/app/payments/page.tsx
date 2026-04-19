"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, CreditCard, Users, Search, ArrowRight, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { formatPHP, formatDate, formatWeekRange, getSundayToSaturdayWeek, STATUS_COLOR, toYMD } from "@/lib/utils";
import { subscribeBookingsChanged } from "@/lib/bookings-sync";

type PaymentRecord = {
  id: string;
  bookingId: number;
  guestName: string;
  unit: string;
  normalizedUnit?: string;
  paymentType: "BK" | "TR";
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
  fpDate: string | Date | null;
  checkInDateKey?: string | null;
  dpAmount?: number | string | null;
  fpAmount?: number | string | null;
  totalFee?: number | string | null;
};

type TransferRecord = {
  id: number;
  sender?: string;
  recipient?: string;
  amount: string | number;
  transferDate: string | Date;
  sourceUnit?: string | null;
  sourceWeekStart?: string | Date | null;
  paymentMethod: string | null;
  status: string;
};

type BookingRecord = {
  id: number;
  guestName: string;
  contactNo?: string | null;
  unit: string;
  checkIn: string | Date;
  checkInDateKey?: string | null;
  checkInTime: string;
  checkOut: string | Date;
  checkOutDateKey?: string | null;
  checkOutTime: string;
  totalFee: number;
  dpAmount: number;
  dpDate: string | Date | null;
  dpMethod: string | null;
  dpReceivedBy: string | null;
  fpAmount: number;
  fpDate: string | Date | null;
  fpMethod: string | null;
  fpReceivedBy: string | null;
  remainingBalance: number;
  paymentStatus: string;
};

type ReceiverAccount = {
  name: string;
  role: "employee" | "host";
  bookingReceived: number;
  incomingTransfers: number;
  outgoingTransfers: number;
  availableBalance: number;
};

export default function PaymentsPage() {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [receiverFilters, setReceiverFilters] = useState<string[]>([]);
  const [unitFilters, setUnitFilters] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"week" | "month" | "month-half" | "month-second-half" | "all">("week");
  const [search, setSearch] = useState("");
  const [compactMode, setCompactMode] = useState(false);
  const [receivers, setReceivers] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weeklyDate, setWeeklyDate] = useState(() => toYMD(new Date()));
  const [monthlyDate, setMonthlyDate] = useState(() => toYMD(new Date()).slice(0, 7));
  const [accountScope, setAccountScope] = useState<"all" | "month">("month");
  const [accountMonth, setAccountMonth] = useState(() => toYMD(new Date()).slice(0, 7));
  const [receiverAccountsSnapshot, setReceiverAccountsSnapshot] = useState<ReceiverAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [selectedReceiverAccount, setSelectedReceiverAccount] = useState<string | null>(null);
  const receiverBalancesRef = useRef<HTMLDivElement | null>(null);

  const normalizeDateInput = (value: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) {
      const day = String(Number(slash[1])).padStart(2, "0");
      const month = String(Number(slash[2])).padStart(2, "0");
      const year = slash[3];
      return `${year}-${month}-${day}`;
    }
    return toYMD(new Date());
  };

  const normalizeName = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();

  const goToReceiverAccount = (name: string) => {
    const normalized = normalizeName(name);
    setSelectedReceiverAccount(normalized);
    receiverBalancesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const shiftWeek = (days: number) => {
    const base = new Date(`${normalizeDateInput(weeklyDate)}T12:00:00`);
    if (Number.isNaN(base.getTime())) return;
    base.setDate(base.getDate() + days);
    setWeeklyDate(toYMD(base));
  };

  const shiftMonth = (months: number) => {
    const base = new Date(`${monthlyDate}-01T12:00:00`);
    if (Number.isNaN(base.getTime())) return;
    base.setMonth(base.getMonth() + months);
    setMonthlyDate(toYMD(base).slice(0, 7));
  };

  const shiftAccountMonth = (months: number) => {
    const base = new Date(`${accountMonth}-01T12:00:00`);
    if (Number.isNaN(base.getTime())) return;
    base.setMonth(base.getMonth() + months);
    setAccountMonth(toYMD(base).slice(0, 7));
  };

  const formatMonthHalfLabel = (value: string, half: "first" | "second") => {
    const base = new Date(`${value}-01T12:00:00`);
    if (Number.isNaN(base.getTime())) return "";
    const opts: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };
    if (half === "first") return `${base.toLocaleDateString("en-PH", opts)} 1-15`;
    const endDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    return `${base.toLocaleDateString("en-PH", opts)} 16-${endDay}`;
  };

  const formatMonthLabel = (value: string) => {
    const base = new Date(`${value}-01T12:00:00`);
    if (Number.isNaN(base.getTime())) return "";
    return base.toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  };

  useEffect(() => {
    if (accountScope === "month") {
      setAccountMonth(monthlyDate);
    }
  }, [accountScope, monthlyDate]);

  useEffect(() => {
    const fetchReceiverAccounts = async () => {
      try {
        setAccountsLoading(true);
        const accountMonthParam = accountScope === "month" ? `&accountMonth=${encodeURIComponent(accountMonth)}` : "";
        const res = await fetch(`/api/payment-transfers?includeAccounts=1&accountScope=${accountScope}${accountMonthParam}&_ts=${Date.now()}`, { cache: "no-store" });
        const payload = await res.json();
        if (!res.ok) {
          console.error("Failed to load receiver account balances", payload);
          setReceiverAccountsSnapshot([]);
          return;
        }
        setReceiverAccountsSnapshot(Array.isArray(payload.accounts) ? payload.accounts : []);
      } catch (error) {
        console.error("Failed to load receiver account balances", error);
        setReceiverAccountsSnapshot([]);
      } finally {
        setAccountsLoading(false);
      }
    };
    fetchReceiverAccounts();
  }, [accountScope, accountMonth]);

  const toggleReceiver = (receiver: string) => {
    setReceiverFilters((current) => {
      if (current.includes(receiver)) return current.filter((item) => item !== receiver);
      return [...current, receiver];
    });
  };

  useEffect(() => {
    const isInitialLoad = records.length === 0 && loading;
    if (!isInitialLoad) setRefreshing(true);

    Promise.all([
      fetch(`/api/bookings?view=all&_ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/settings?_ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/payment-transfers?scope=all&_ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([bookings, settings, transfers]) => {
        const bookingRowsRaw: BookingRecord[] = Array.isArray(bookings) ? bookings : [];
        const bookingRows: PaymentRecord[] = bookingRowsRaw.map((booking) => ({
          id: `booking-${booking.id}`,
          bookingId: booking.id,
          guestName: booking.guestName,
          unit: booking.unit,
          normalizedUnit: String(booking.unit ?? "").replace(/^Unit\s*/i, "").trim(),
          paymentType: "BK",
          amount: Number(booking.totalFee ?? 0),
          paymentDate: booking.checkIn,
          checkInDateKey: booking.checkInDateKey || toYMD(booking.checkIn),
          method: booking.dpMethod || booking.fpMethod,
          receivedBy: booking.dpReceivedBy || booking.fpReceivedBy,
          bookingDate: booking.checkIn,
          checkInTime: booking.checkInTime,
          checkOutTime: booking.checkOutTime,
          paymentStatus: booking.paymentStatus,
          remainingBalance: Number(booking.remainingBalance ?? 0),
          dpDate: booking.dpDate,
          fpDate: booking.fpDate,
          dpAmount: booking.dpAmount,
          fpAmount: booking.fpAmount,
          totalFee: booking.totalFee,
        }));

        const transferRowsRaw: TransferRecord[] = Array.isArray(transfers) ? transfers : [];
        const transferRows: PaymentRecord[] = transferRowsRaw.flatMap((t) => {
          const amount = Number(t.amount || 0);
          const date = t.sourceWeekStart ?? t.transferDate ?? new Date().toISOString();
          const sender = (t.sender ?? "").toString();
          const recipient = (t.recipient ?? "").toString();
          const sourceUnit = t.sourceUnit && String(t.sourceUnit).trim() ? String(t.sourceUnit) : "TRANSFER";

          const out: PaymentRecord = {
            id: `tr-out-${t.id}`,
            bookingId: 0,
            guestName: `Transfer to ${recipient}`,
            unit: sourceUnit,
            paymentType: "TR",
            amount: -amount,
            paymentDate: date,
            method: t.paymentMethod,
            receivedBy: sender,
            bookingDate: date,
            checkInTime: "",
            checkOutTime: "",
            paymentStatus: t.status || "Transferred",
            remainingBalance: 0,
            dpDate: null,
            fpDate: null,
          };

          const incoming: PaymentRecord = {
            id: `tr-in-${t.id}`,
            bookingId: 0,
            guestName: `Transfer from ${sender}`,
            unit: sourceUnit,
            paymentType: "TR",
            amount,
            paymentDate: date,
            method: t.paymentMethod,
            receivedBy: recipient,
            bookingDate: date,
            checkInTime: "",
            checkOutTime: "",
            paymentStatus: t.status || "Transferred",
            remainingBalance: 0,
            dpDate: null,
            fpDate: null,
          };

          return [out, incoming];
        });

        setRecords([...bookingRows, ...transferRows]);

        if (Array.isArray(settings.receivers) && settings.receivers.length > 0) {
          setReceivers(settings.receivers);
        }
        if (Array.isArray(settings.units) && settings.units.length > 0) {
          setUnits(settings.units.map((u: string) => String(u).replace(/^Unit\s*/i, "")));
        }
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [weeklyDate, scopeFilter]);

  useEffect(() => {
    return subscribeBookingsChanged(() => {
      setRefreshing(true);
      Promise.all([
        fetch(`/api/bookings?view=all&_ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/settings?_ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/payment-transfers?scope=all&_ts=${Date.now()}`, { cache: "no-store" }).then((r) => r.json()),
      ])
        .then(([bookings, settings, transfers]) => {
          const bookingRowsRaw: BookingRecord[] = Array.isArray(bookings) ? bookings : [];
          const bookingRows: PaymentRecord[] = bookingRowsRaw.map((booking) => ({
            id: `booking-${booking.id}`,
            bookingId: booking.id,
            guestName: booking.guestName,
            unit: booking.unit,
            normalizedUnit: String(booking.unit ?? "").replace(/^Unit\s*/i, "").trim(),
            paymentType: "BK",
            amount: Number(booking.totalFee ?? 0),
            paymentDate: booking.checkIn,
            checkInDateKey: booking.checkInDateKey || toYMD(booking.checkIn),
            method: booking.dpMethod || booking.fpMethod,
            receivedBy: booking.dpReceivedBy || booking.fpReceivedBy,
            bookingDate: booking.checkIn,
            checkInTime: booking.checkInTime,
            checkOutTime: booking.checkOutTime,
            paymentStatus: booking.paymentStatus,
            remainingBalance: Number(booking.remainingBalance ?? 0),
            dpDate: booking.dpDate,
            fpDate: booking.fpDate,
            dpAmount: booking.dpAmount,
            fpAmount: booking.fpAmount,
            totalFee: booking.totalFee,
          }));

          const transferRowsRaw: TransferRecord[] = Array.isArray(transfers) ? transfers : [];
          const transferRows: PaymentRecord[] = transferRowsRaw.flatMap((t) => {
            const amount = Number(t.amount || 0);
            const date = t.sourceWeekStart ?? t.transferDate ?? new Date().toISOString();
            const sender = (t.sender ?? "").toString();
            const recipient = (t.recipient ?? "").toString();
            const sourceUnit = t.sourceUnit && String(t.sourceUnit).trim() ? String(t.sourceUnit) : "TRANSFER";

            const out: PaymentRecord = {
              id: `tr-out-${t.id}`,
              bookingId: 0,
              guestName: `Transfer to ${recipient}`,
              unit: sourceUnit,
              paymentType: "TR",
              amount: -amount,
              paymentDate: date,
              method: t.paymentMethod,
              receivedBy: sender,
              bookingDate: date,
              checkInTime: "",
              checkOutTime: "",
              paymentStatus: t.status || "Transferred",
              remainingBalance: 0,
              dpDate: null,
              fpDate: null,
            };

            const incoming: PaymentRecord = {
              id: `tr-in-${t.id}`,
              bookingId: 0,
              guestName: `Transfer from ${sender}`,
              unit: sourceUnit,
              paymentType: "TR",
              amount,
              paymentDate: date,
              method: t.paymentMethod,
              receivedBy: recipient,
              bookingDate: date,
              checkInTime: "",
              checkOutTime: "",
              paymentStatus: t.status || "Transferred",
              remainingBalance: 0,
              dpDate: null,
              fpDate: null,
            };

            return [out, incoming];
          });

          setRecords([...bookingRows, ...transferRows]);

          if (Array.isArray(settings.receivers) && settings.receivers.length > 0) {
            setReceivers(settings.receivers);
          }
          if (Array.isArray(settings.units) && settings.units.length > 0) {
            setUnits(settings.units.map((u: string) => String(u).replace(/^Unit\s*/i, "")));
          }
        })
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    });
  }, [weeklyDate, scopeFilter]);

  const toggleUnit = (unit: string) => {
    setUnitFilters((current) => {
      if (current.includes(unit)) return current.filter((item) => item !== unit);
      return [...current, unit];
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const week = getSundayToSaturdayWeek(normalizeDateInput(weeklyDate));
    const weekStartKey = week.startDate;
    const weekEndKey = week.endDate;
    const monthKey = monthlyDate;

    return records.filter((record) => {
      if (scopeFilter === "week") {
        const recordDateKey = record.paymentType === "BK"
          ? (record.checkInDateKey || toYMD(record.bookingDate))
          : toYMD(record.paymentDate ?? record.bookingDate);
        if (recordDateKey < weekStartKey || recordDateKey > weekEndKey) return false;
      } else if (scopeFilter === "month" || scopeFilter === "month-half" || scopeFilter === "month-second-half") {
        const recordDateKey = record.paymentType === "BK"
          ? (record.checkInDateKey || toYMD(record.bookingDate))
          : toYMD(record.paymentDate ?? record.bookingDate);
        if (!recordDateKey.startsWith(monthKey)) return false;
        if (scopeFilter === "month-half") {
          const day = Number(recordDateKey.slice(8, 10));
          if (day < 1 || day > 15) return false;
        }
        if (scopeFilter === "month-second-half") {
          const day = Number(recordDateKey.slice(8, 10));
          if (day < 16) return false;
        }
      }

      if (receiverFilters.length > 0) {
        const receiverSet = new Set(receiverFilters.map((r) => r.toLowerCase()));
        if (!receiverSet.has((record.receivedBy ?? "").toLowerCase())) return false;
      }

      // Keep transfer records visible even when unit filters are active,
      // so sender deductions are reflected in totals.
      const normalizedUnit = String(record.normalizedUnit ?? record.unit ?? "").replace(/^Unit\s*/i, "").trim();
      if (unitFilters.length > 0 && record.unit !== "TRANSFER" && !unitFilters.includes(normalizedUnit)) return false;
      if (typeFilter && record.paymentType !== typeFilter) return false;
      if (statusFilter && record.paymentStatus !== statusFilter) return false;
      if (balanceFilter === "with" && record.remainingBalance <= 0) return false;
      if (balanceFilter === "settled" && record.remainingBalance > 0) return false;

      if (!q) return true;
      return (
        record.guestName.toLowerCase().includes(q) ||
        normalizedUnit.toLowerCase().includes(q) ||
        (record.receivedBy ?? "").toLowerCase().includes(q)
      );
    });
  }, [records, receiverFilters, unitFilters, typeFilter, statusFilter, balanceFilter, search, scopeFilter, weeklyDate, monthlyDate]);

  const getPaidAmount = (record: PaymentRecord) => {
    if (record.paymentType !== "BK") return 0;

    const dp = Number(record.dpAmount ?? 0);
    const fp = Number(record.fpAmount ?? 0);
    const fromParts = dp + fp;
    if (fromParts > 0) return fromParts;

    const total = Number(record.totalFee ?? record.amount ?? 0);
    const remaining = Number(record.remainingBalance ?? 0);
    return Math.max(0, total - remaining);
  };

  const getBookingTotal = (record: PaymentRecord) => {
    if (record.paymentType !== "BK") return 0;
    return Number(record.totalFee ?? record.amount ?? 0);
  };

  const totals = useMemo(() => {
    const bookingRecords = filtered.filter((r) => r.paymentType === "BK");
    const totalAmount = bookingRecords.reduce((sum, record) => sum + getBookingTotal(record), 0);
    const paidAmount = bookingRecords.reduce((sum, record) => sum + getPaidAmount(record), 0);
    const remainingAmount = bookingRecords.reduce((sum, record) => sum + Number(record.remainingBalance ?? 0), 0);
    const outstandingCount = filtered.filter((r) => r.remainingBalance > 0).length;
    return { outstandingCount, totalAmount, paidAmount, remainingAmount };
  }, [filtered]);

  const receiverTotals = useMemo(() => {
    return receiverAccountsSnapshot.reduce(
      (acc, account) => {
        acc.members += 1;
        acc.bookingReceived += Number(account.bookingReceived || 0);
        acc.incomingTransfers += Number(account.incomingTransfers || 0);
        acc.outgoingTransfers += Number(account.outgoingTransfers || 0);
        acc.availableBalance += Number(account.availableBalance || 0);
        return acc;
      },
      {
        members: 0,
        bookingReceived: 0,
        incomingTransfers: 0,
        outgoingTransfers: 0,
        availableBalance: 0,
      }
    );
  }, [receiverAccountsSnapshot]);

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
            <h2 className="text-sm font-semibold text-gray-900">Payment Scope</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {scopeFilter === "all"
                ? "All payment records"
                : scopeFilter === "month"
                  ? new Date(`${monthlyDate}-01T12:00:00`).toLocaleDateString("en-PH", { month: "long", year: "numeric" })
                  : scopeFilter === "month-half"
                    ? formatMonthHalfLabel(monthlyDate, "first")
                    : scopeFilter === "month-second-half"
                      ? formatMonthHalfLabel(monthlyDate, "second")
                      : formatWeekRange(getSundayToSaturdayWeek(weeklyDate).startDate, getSundayToSaturdayWeek(weeklyDate).endDate)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              className="input py-1.5 text-xs min-w-[160px]"
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as "week" | "month" | "month-half" | "month-second-half" | "all") }
            >
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="month-half">First half of month</option>
              <option value="month-second-half">Second half of month</option>
              <option value="all">All records</option>
            </select>

            {scopeFilter === "week" && (
              <>
                <button
                  type="button"
                  onClick={() => shiftWeek(-7)}
                  className="btn-secondary text-xs py-1.5 justify-center"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev Week
                </button>
                <input
                  type="date"
                  className="input py-1.5 text-xs w-full sm:w-auto"
                  value={weeklyDate}
                  onChange={(e) => setWeeklyDate(normalizeDateInput(e.target.value))}
                />
                <button
                  type="button"
                  onClick={() => shiftWeek(7)}
                  className="btn-secondary text-xs py-1.5 justify-center"
                >
                  Next Week <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {(scopeFilter === "month" || scopeFilter === "month-half" || scopeFilter === "month-second-half") && (
              <>
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="btn-secondary text-xs py-1.5 justify-center"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev Month
                </button>
                <input
                  type="month"
                  className="input py-1.5 text-xs w-full sm:w-auto"
                  value={monthlyDate}
                  onChange={(e) => setMonthlyDate(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  className="btn-secondary text-xs py-1.5 justify-center"
                >
                  Next Month <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
            {refreshing && (
              <span className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
        <div className="xl:col-span-5 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
            <div className="stat-card">
              <div className="flex items-center gap-1.5 text-blue-600 mb-1">
                <CreditCard className="w-4 h-4" />
                <span className="text-xs font-semibold text-gray-500">Records</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center gap-1.5 text-purple-600 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs font-semibold text-gray-500">With balance</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{totals.outstandingCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="stat-card">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Booking Amount</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900">{formatPHP(totals.totalAmount)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Paid Already</p>
              <p className="text-lg sm:text-xl font-bold text-green-700">{formatPHP(totals.paidAmount)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Remaining Balance</p>
              <p className="text-lg sm:text-xl font-bold text-red-600">{formatPHP(totals.remainingAmount)}</p>
            </div>
          </div>

          <div className="card p-3 sm:p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input pl-9"
                placeholder="Search guest, unit, receiver..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All types</option>
                <option value="BK">Booking</option>
                <option value="TR">Transfer</option>
              </select>
              <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All payment status</option>
                <option value="Fully Paid">Fully Paid</option>
                <option value="DP Paid">DP Paid</option>
                <option value="No DP">No DP</option>
                <option value="Transferred">Transferred</option>
              </select>
              <select className="input sm:col-span-2" value={balanceFilter} onChange={(e) => setBalanceFilter(e.target.value)}>
                <option value="">All balances</option>
                <option value="with">With balance</option>
                <option value="settled">Fully settled</option>
              </select>
            </div>
          </div>

          {receivers.length > 0 && (
            <div className="card p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Received By</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Filter payments and transfers by person</p>
                </div>
                {receiverFilters.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setReceiverFilters([])}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {receivers.map((name) => (
                  <label
                    key={name}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${receiverFilters.includes(name) ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={receiverFilters.includes(name)}
                      onChange={() => toggleReceiver(name)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="truncate">{name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {units.length > 0 && (
            <div className="card p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Units</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Narrow payment records by unit</p>
                </div>
                {unitFilters.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setUnitFilters([])}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {units.map((unit) => (
                  <label
                    key={unit}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${unitFilters.includes(unit) ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}
                  >
                    <input
                      type="checkbox"
                      checked={unitFilters.includes(unit)}
                      onChange={() => toggleUnit(unit)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="truncate">Unit {unit}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="card p-4 sm:p-5" ref={receiverBalancesRef}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Receiver Account Balances</h2>
                <p className="text-xs text-gray-400 mt-0.5">Connected balances for this, previous, and next month</p>
              </div>
              <select
                className="input py-1.5 text-xs"
                value={accountScope}
                onChange={(e) => setAccountScope(e.target.value as "all" | "month")}
              >
                <option value="month">By month</option>
                <option value="all">All time</option>
              </select>
            </div>
            {accountScope === "month" && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => shiftAccountMonth(-1)}
                  className="btn-secondary text-xs py-1.5 justify-center"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev Month
                </button>
                <input
                  type="month"
                  className="input py-1.5 text-xs w-full sm:w-auto"
                  value={accountMonth}
                  onChange={(e) => setAccountMonth(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => shiftAccountMonth(1)}
                  className="btn-secondary text-xs py-1.5 justify-center"
                >
                  Next Month <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="rounded-lg border border-gray-200 bg-slate-50 px-3 py-3 mb-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Receiver totals</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{formatPHP(receiverTotals.availableBalance)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Bookings: {formatPHP(receiverTotals.bookingReceived)} · In: {formatPHP(receiverTotals.incomingTransfers)} · Out: {formatPHP(receiverTotals.outgoingTransfers)}
              </p>
            </div>
            {accountsLoading ? (
              <div className="text-sm text-gray-500">Loading balances…</div>
            ) : receiverAccountsSnapshot.length === 0 ? (
              <div className="text-sm text-gray-500">No receiver balances available.</div>
            ) : (
              <div className="space-y-2">
                {receiverAccountsSnapshot.map((account) => {
                  const accountKey = normalizeName(account.name);
                  const accountSelected = selectedReceiverAccount === accountKey;
                  return (
                    <div
                      key={account.name}
                      className={`rounded-lg border p-3 ${accountSelected ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{account.name}</p>
                          <p className="text-xs text-gray-500">{account.role === "host" ? "Host" : "Employee"}</p>
                        </div>
                        <p className={`text-sm font-semibold ${account.availableBalance < 0 ? "text-red-600" : "text-green-700"}`}>
                          {formatPHP(account.availableBalance)}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Bookings: {formatPHP(account.bookingReceived)} · In: {formatPHP(account.incomingTransfers)} · Out: {formatPHP(account.outgoingTransfers)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-7">
          <div className="card p-3 sm:p-4 mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Records List</h3>
              <p className="text-xs text-gray-500">Toggle compact mode for denser rows</p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCompactMode((v) => !v)}
            >
              {compactMode ? "Normal View" : "Compact View"}
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">No payment records found</div>
          ) : (
            <div className="space-y-2">
          {filtered.map((record) => (
            <div key={record.id} className={`card ${compactMode ? "p-2" : "p-3 sm:p-4"} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${record.paymentType === "BK" ? "bg-sky-100 text-sky-800" : "bg-indigo-100 text-indigo-800"}`}>
                    {record.paymentType === "BK" ? "Booking" : "Transfer"}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">{record.unit === "TRANSFER" ? "Transfer" : `Unit ${record.unit}`}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[record.paymentStatus] ?? "bg-gray-100 text-gray-600"}`}>
                    {record.paymentStatus}
                  </span>
                </div>
                <p className={`${compactMode ? "text-sm" : ""} font-semibold text-gray-900 truncate`}>{record.guestName}</p>
                <div className={`${compactMode ? "mt-0.5" : "mt-1"} flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500`}>
                    {record.paymentType === "BK" ? (
                      <>
                        <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />Check-in: {formatDate(record.bookingDate)}</span>
                        <span>DP: {formatDate(record.dpDate)}</span>
                        <span>FP: {formatDate(record.fpDate)}</span>
                        <span>Received by: <span className="font-semibold text-gray-700">{record.receivedBy ?? "—"}</span></span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{formatDate(record.paymentDate)}</span>
                        <span>Method: {record.method ?? "—"}</span>
                        <span>Received by: <span className="font-semibold text-gray-700">{record.receivedBy ?? "—"}</span></span>
                      </>
                    )}
                </div>
                {record.receivedBy ? (
                  <button
                    type="button"
                    onClick={() => goToReceiverAccount(record.receivedBy ?? "")}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View receiver balance
                  </button>
                ) : null}
                  {record.paymentType === "BK" && (
                  <div className="mt-1 text-xs">
                    Paid: <span className="font-semibold text-green-700">{formatPHP(getPaidAmount(record))}</span>
                    <span className="text-gray-400"> / Total: {formatPHP(getBookingTotal(record))}</span>
                    <span className="mx-1.5 text-gray-300">|</span>
                    Balance: <span className={record.remainingBalance > 0 ? "font-semibold text-red-600" : "font-semibold text-green-600"}>{formatPHP(record.remainingBalance)}</span>
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-lg font-bold ${record.amount < 0 ? "text-red-600" : "text-gray-900"}`}>{formatPHP(record.amount)}</p>
                {record.bookingId > 0 && (
                  <Link href={`/bookings?edit=${record.bookingId}`} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1">
                    View booking <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
