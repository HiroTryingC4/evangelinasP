"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { formatPHP, formatDate, formatWeekRange, UNITS } from "@/lib/utils";

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function FinancesPage() {
  const [tab, setTab] = useState<"bills" | "wages" | "income" | "expenses">("bills");
  const [units, setUnits] = useState<string[]>(UNITS);
  const [selectedRevenueUnits, setSelectedRevenueUnits] = useState<string[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [wages, setWages] = useState<any[]>([]);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");
  const [weeklyDate, setWeeklyDate] = useState(() => toYMD(new Date()));
  const [monthlyValue, setMonthlyValue] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/settings")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.units) && d.units.length > 0) setUnits(d.units);
        })
        .catch(() => {}),
      fetch("/api/bookings").then((r) => r.json()).then((d) => setBookings(d || [])),
      fetch("/api/bills").then((r) => r.json()).then((d) => setBills(d || [])),
      fetch("/api/wages").then((r) => r.json()).then((d) => setWages(d || [])),
      fetch("/api/income").then((r) => r.json()).then((d) => setIncomes(d || [])),
      fetch("/api/expenses").then((r) => r.json()).then((d) => setExpenses(d || [])),
    ]).finally(() => setLoading(false));
  }, []);

  const toggleRevenueUnit = (unitCode: string) => {
    setSelectedRevenueUnits((prev) => {
      if (prev.includes(unitCode)) return prev.filter((u) => u !== unitCode);
      return [...prev, unitCode];
    });
  };

  const handleAddBill = async (e: React.FormEvent, data: any) => {
    e.preventDefault();
    try {
      await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const res = await fetch("/api/bills");
      setBills(await res.json());
    } catch (e) {
      console.error("Failed to add bill:", e);
    }
  };

  const handleAddWage = async (e: React.FormEvent, data: any) => {
    e.preventDefault();
    try {
      await fetch("/api/wages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const res = await fetch("/api/wages");
      setWages(await res.json());
    } catch (e) {
      console.error("Failed to add wage:", e);
    }
  };

  const handleAddExpense = async (e: React.FormEvent, data: any) => {
    e.preventDefault();
    try {
      await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const res = await fetch("/api/expenses");
      setExpenses(await res.json());
    } catch (e) {
      console.error("Failed to add expense:", e);
    }
  };

  const handleAddIncome = async (e: React.FormEvent, data: any) => {
    e.preventDefault();
    try {
      await fetch("/api/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const res = await fetch("/api/income");
      setIncomes(await res.json());
    } catch (e) {
      console.error("Failed to add income:", e);
    }
  };

  const handleDelete = async (type: "bills" | "wages" | "incomes" | "expenses", id: number) => {
    if (!confirm("Delete this record?")) return;
    try {
      const apiType = type === "incomes" ? "income" : type;
      await fetch(`/api/${apiType}/${id}`, { method: "DELETE" });
      if (type === "bills") {
        setBills(bills.filter((b) => b.id !== id));
      } else if (type === "wages") {
        setWages(wages.filter((w) => w.id !== id));
      } else if (type === "incomes") {
        setIncomes(incomes.filter((i) => i.id !== id));
      } else {
        setExpenses(expenses.filter((e) => e.id !== id));
      }
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  };

  const handleMarkPaid = async (type: "bills" | "wages" | "incomes" | "expenses", item: any) => {
    try {
      const apiType = type === "incomes" ? "income" : type;
      await fetch(`/api/${apiType}/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, status: "paid", paidDate: new Date().toISOString().split("T")[0] }),
      });
      if (type === "bills") {
        setBills(bills.map((b) => (b.id === item.id ? { ...b, status: "paid" } : b)));
      } else if (type === "wages") {
        setWages(wages.map((w) => (w.id === item.id ? { ...w, status: "paid" } : w)));
      } else if (type === "incomes") {
        setIncomes(incomes.map((i) => (i.id === item.id ? { ...i, status: "paid" } : i)));
      } else {
        setExpenses(expenses.map((e) => (e.id === item.id ? { ...e, status: "paid" } : e)));
      }
    } catch (e) {
      console.error("Failed to mark paid:", e);
    }
  };

  const getFilteredData = (data: any[]) => filter === "all" ? data : data.filter((d) => d.status === filter);

  const billsFiltered = getFilteredData(bills);
  const wagesFiltered = getFilteredData(wages);
  const incomesFiltered = getFilteredData(incomes);
  const expensesFiltered = getFilteredData(expenses);
  const expensesSortedByUpcoming = [...expensesFiltered].sort((a, b) => {
    const aDate = new Date(a.dueDate ?? a.expenseDate).getTime();
    const bDate = new Date(b.dueDate ?? b.expenseDate).getTime();
    if (aDate !== bDate) return aDate - bDate;
    return a.id - b.id;
  });

  const billsTotal = bills.reduce((s, b) => s + b.amount, 0);
  const wagesTotal = wages.reduce((s, w) => s + w.amount, 0);
  const incomesTotal = incomes.reduce((s, i) => s + Number(i.amount || 0), 0);
  const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const billsPending = bills.filter((b) => b.status === "pending").reduce((s, b) => s + b.amount, 0);
  const billsPaid = bills.filter((b) => b.status === "paid").reduce((s, b) => s + b.amount, 0);
  const wagesPending = wages.filter((w) => w.status === "pending").reduce((s, w) => s + w.amount, 0);
  const wagesPaid = wages.filter((w) => w.status === "paid").reduce((s, w) => s + w.amount, 0);
  const incomesPending = incomes.filter((i) => i.status === "pending").reduce((s, i) => s + Number(i.amount || 0), 0);
  const incomesPaid = incomes.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount || 0), 0);
  const expensesPending = expenses.filter((e) => e.status === "pending").reduce((s, e) => s + Number(e.amount || 0), 0);
  const expensesPaid = expenses.filter((e) => e.status === "paid").reduce((s, e) => s + Number(e.amount || 0), 0);

  const pendingTotal = billsPending + wagesPending + expensesPending;
  const paidTotal = billsPaid + wagesPaid + expensesPaid;
  const grandTotal = billsTotal + wagesTotal + expensesTotal;

  const weekAnchor = new Date(`${weeklyDate}T12:00:00`);
  const safeAnchor = Number.isNaN(weekAnchor.getTime()) ? new Date() : weekAnchor;
  const weekStart = new Date(safeAnchor);
  weekStart.setDate(safeAnchor.getDate() - safeAnchor.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const inSelectedWeek = (value: string | Date | null | undefined) => {
    if (!value) return false;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return false;
    return d >= weekStart && d <= weekEnd;
  };

  const weeklyBills = bills.filter((b) => inSelectedWeek(b.billDate));
  const weeklyWages = wages.filter((w) => inSelectedWeek(w.payDate));
  const weeklyIncome = incomes.filter((i) => inSelectedWeek(i.incomeDate));
  const weeklyExpenses = expenses.filter((e) => inSelectedWeek(e.expenseDate));

  const bookingsByRevenueScope = selectedRevenueUnits.length > 0
    ? bookings.filter((b) => selectedRevenueUnits.includes(String(b.unit).replace(/^Unit\s*/i, "")))
    : bookings;

  const weeklyBookingRevenue = bookingsByRevenueScope
    .filter((b) => inSelectedWeek(b.checkIn))
    .reduce((s, b) => s + (Number(b.totalFee) || 0), 0);
  const weeklyExternalIncome = weeklyIncome.reduce((s, i) => s + Number(i.amount || 0), 0);
  const weeklyRevenue = weeklyBookingRevenue + weeklyExternalIncome;

  const weeklyBillsTotal = weeklyBills.reduce((s, b) => s + b.amount, 0);
  const weeklyWagesTotal = weeklyWages.reduce((s, w) => s + w.amount, 0);
  const weeklyExpensesTotal = weeklyExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const weeklyPendingTotal =
    weeklyBills.filter((b) => b.status === "pending").reduce((s, b) => s + b.amount, 0) +
    weeklyWages.filter((w) => w.status === "pending").reduce((s, w) => s + w.amount, 0) +
    weeklyExpenses.filter((e) => e.status === "pending").reduce((s, e) => s + Number(e.amount || 0), 0);

  const weeklyPaidTotal =
    weeklyBills.filter((b) => b.status === "paid").reduce((s, b) => s + b.amount, 0) +
    weeklyWages.filter((w) => w.status === "paid").reduce((s, w) => s + w.amount, 0) +
    weeklyExpenses.filter((e) => e.status === "paid").reduce((s, e) => s + Number(e.amount || 0), 0);

  const weeklyGrandTotal = weeklyBillsTotal + weeklyWagesTotal + weeklyExpensesTotal;
  const weeklyNetAfterCosts = weeklyRevenue - weeklyGrandTotal;

  const [monthYear, monthNumber] = monthlyValue.split("-").map(Number);
  const monthStart = new Date(monthYear || new Date().getFullYear(), (monthNumber || 1) - 1, 1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);

  const inSelectedMonth = (value: string | Date | null | undefined) => {
    if (!value) return false;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return false;
    return d >= monthStart && d <= monthEnd;
  };

  const monthlyBillsTotal = bills
    .filter((b) => inSelectedMonth(b.billDate))
    .reduce((s, b) => s + b.amount, 0);
  const monthlyWagesTotal = wages
    .filter((w) => inSelectedMonth(w.payDate))
    .reduce((s, w) => s + w.amount, 0);
  const monthlyIncomeTotal = incomes
    .filter((i) => inSelectedMonth(i.incomeDate))
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const monthlyExpensesTotal = expenses
    .filter((e) => inSelectedMonth(e.expenseDate))
    .reduce((s, e) => s + Number(e.amount || 0), 0);

  const monthlyBookingRevenue = bookingsByRevenueScope
    .filter((b) => inSelectedMonth(b.checkIn))
    .reduce((s, b) => s + (Number(b.totalFee) || 0), 0);
  const monthlyRevenue = monthlyBookingRevenue + monthlyIncomeTotal;

  const monthlyCostsTotal = monthlyBillsTotal + monthlyWagesTotal + monthlyExpensesTotal;
  const monthlyNetAfterCosts = monthlyRevenue - monthlyCostsTotal;

  const getNetLabel = (value: number) => {
    if (value > 0) return "Profit";
    if (value < 0) return "Loss";
    return "Break-even";
  };

  const getNetBadgeClass = (value: number) => {
    if (value > 0) return "bg-emerald-100 text-emerald-700";
    if (value < 0) return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-700";
  };

  const shiftWeek = (days: number) => {
    const d = new Date(`${weeklyDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) return;
    d.setDate(d.getDate() + days);
    setWeeklyDate(toYMD(d));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Financial Tracking</h1>
        <Link href="/" className="text-xs text-blue-600 hover:underline">← Back to Dashboard</Link>
      </div>

      <details className="card p-4 sm:p-5" open>
        <summary className="cursor-pointer list-none">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Complete Computation</p>
          <p className="text-xs text-gray-400 mt-1">Grand Total = Bills + Wages + Expenses</p>
        </summary>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-[11px] uppercase text-gray-500">Bills Total</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{formatPHP(billsTotal)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-[11px] uppercase text-gray-500">Wages Total</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{formatPHP(wagesTotal)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 col-span-2 lg:col-span-1">
            <p className="text-[11px] uppercase text-gray-500">Expenses Total</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{formatPHP(expensesTotal)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
            <p className="text-[11px] uppercase text-blue-700">Grand Total</p>
            <p className="text-xl font-bold text-blue-800 mt-0.5">{formatPHP(grandTotal)}</p>
          </div>
          <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-3">
            <p className="text-[11px] uppercase text-yellow-700">Pending Total</p>
            <p className="text-xl font-bold text-yellow-800 mt-0.5">{formatPHP(pendingTotal)}</p>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-100 p-3">
            <p className="text-[11px] uppercase text-green-700">Paid Total</p>
            <p className="text-xl font-bold text-green-800 mt-0.5">{formatPHP(paidTotal)}</p>
          </div>
        </div>
      </details>

      <details className="card p-4 sm:p-5" open>
        <summary className="cursor-pointer list-none">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Weekly Totals</p>
              <p className="text-xs text-gray-400 mt-1">
                {formatWeekRange(weekStart, weekEnd)}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Revenue scope below applies to both weekly and monthly net.</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">Click to collapse</div>
          </div>
        </summary>

        <div className="flex items-center gap-2 mt-3">
          <button type="button" onClick={() => shiftWeek(-7)} className="btn-secondary text-xs py-1.5 px-3">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            className="input py-1.5 text-xs w-auto"
            value={weeklyDate}
            onChange={(e) => setWeeklyDate(e.target.value)}
          />
          <button type="button" onClick={() => shiftWeek(7)} className="btn-secondary text-xs py-1.5 px-3">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-3">
          <label className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedRevenueUnits.length === 0}
              onChange={() => setSelectedRevenueUnits([])}
            />
            All Units
          </label>
          {units.map((u) => (
            <label key={u} className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedRevenueUnits.includes(u)}
                onChange={() => toggleRevenueUnit(u)}
              />
              Unit {u}
            </label>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 col-span-2 lg:col-span-1">
            <p className="text-[11px] uppercase text-indigo-700">
              Weekly Revenue ({selectedRevenueUnits.length > 0 ? `${selectedRevenueUnits.length} Unit${selectedRevenueUnits.length > 1 ? "s" : ""}` : "All Units"} + External)
            </p>
            <p className="text-lg font-bold text-indigo-800 mt-0.5">{formatPHP(weeklyRevenue)}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
            <p className="text-[11px] uppercase text-emerald-700">External Income This Week</p>
            <p className="text-lg font-bold text-emerald-800 mt-0.5">{formatPHP(weeklyExternalIncome)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-[11px] uppercase text-gray-500">Bills This Week</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{formatPHP(weeklyBillsTotal)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-[11px] uppercase text-gray-500">Wages This Week</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{formatPHP(weeklyWagesTotal)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 col-span-2 lg:col-span-1">
            <p className="text-[11px] uppercase text-gray-500">Expenses This Week</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{formatPHP(weeklyExpensesTotal)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
            <p className="text-[11px] uppercase text-blue-700">Weekly Grand Total</p>
            <p className="text-xl font-bold text-blue-800 mt-0.5">{formatPHP(weeklyGrandTotal)}</p>
          </div>
          <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-3">
            <p className="text-[11px] uppercase text-yellow-700">Weekly Pending</p>
            <p className="text-xl font-bold text-yellow-800 mt-0.5">{formatPHP(weeklyPendingTotal)}</p>
          </div>
          <div className="rounded-lg bg-green-50 border border-green-100 p-3">
            <p className="text-[11px] uppercase text-green-700">Weekly Paid</p>
            <p className="text-xl font-bold text-green-800 mt-0.5">{formatPHP(weeklyPaidTotal)}</p>
          </div>
        </div>

        <div className="rounded-lg border mt-3 p-3 bg-white">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase text-gray-500">Weekly Net (Revenue - Costs)</p>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${getNetBadgeClass(weeklyNetAfterCosts)}`}>
              {getNetLabel(weeklyNetAfterCosts)}
            </span>
          </div>
          <p className={`text-xl font-bold mt-0.5 ${weeklyNetAfterCosts >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {formatPHP(weeklyNetAfterCosts)}
          </p>
        </div>
      </details>

      <details className="card p-4 sm:p-5">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Monthly Totals</p>
              <p className="text-xs text-gray-400 mt-1">
                {monthStart.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="hidden sm:flex text-xs text-gray-400">Click to expand</div>
          </div>
        </summary>

        <div className="mt-3">
          <input
            type="month"
            className="input py-1.5 text-xs w-auto"
            value={monthlyValue}
            onChange={(e) => setMonthlyValue(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 col-span-2 lg:col-span-1">
            <p className="text-[11px] uppercase text-indigo-700">
              Monthly Revenue ({selectedRevenueUnits.length > 0 ? `${selectedRevenueUnits.length} Unit${selectedRevenueUnits.length > 1 ? "s" : ""}` : "All Units"} + External)
            </p>
            <p className="text-lg font-bold text-indigo-800 mt-0.5">{formatPHP(monthlyRevenue)}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
            <p className="text-[11px] uppercase text-emerald-700">External Income This Month</p>
            <p className="text-lg font-bold text-emerald-800 mt-0.5">{formatPHP(monthlyIncomeTotal)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-[11px] uppercase text-gray-500">Bills This Month</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{formatPHP(monthlyBillsTotal)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-[11px] uppercase text-gray-500">Wages This Month</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{formatPHP(monthlyWagesTotal)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-[11px] uppercase text-gray-500">Expenses This Month</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{formatPHP(monthlyExpensesTotal)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
            <p className="text-[11px] uppercase text-blue-700">Monthly Cost Total</p>
            <p className="text-xl font-bold text-blue-800 mt-0.5">{formatPHP(monthlyCostsTotal)}</p>
          </div>
          <div className="rounded-lg bg-white border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase text-gray-500">Monthly Net (Revenue - Costs)</p>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${getNetBadgeClass(monthlyNetAfterCosts)}`}>
                {getNetLabel(monthlyNetAfterCosts)}
              </span>
            </div>
            <p className={`text-xl font-bold mt-0.5 ${monthlyNetAfterCosts >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {formatPHP(monthlyNetAfterCosts)}
            </p>
          </div>
        </div>
      </details>

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto sticky top-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70 z-10">
        <button
          onClick={() => setTab("bills")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            tab === "bills"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Bills
        </button>
        <button
          onClick={() => setTab("wages")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            tab === "wages"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Wages
        </button>
        <button
          onClick={() => setTab("income")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            tab === "income"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Income
        </button>
        <button
          onClick={() => setTab("expenses")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            tab === "expenses"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Expenses
        </button>
      </div>

      {/* BILLS TAB */}
      {tab === "bills" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Total Bills</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatPHP(billsTotal)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Pending</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">{formatPHP(billsPending)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Paid</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{formatPHP(billsPaid)}</p>
            </div>
          </div>

          <BillForm onSubmit={handleAddBill} />

          <div className="flex gap-2 mb-4">
            {["all", "pending", "paid"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filter === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {billsFiltered.map((bill) => (
              <ItemCard
                key={bill.id}
                item={bill}
                type="bills"
                onDelete={() => handleDelete("bills", bill.id)}
                onMarkPaid={() => handleMarkPaid("bills", bill)}
                fields={[bill.category, bill.paymentMethod ? `Method: ${bill.paymentMethod}` : "", formatDate(bill.billDate)]}
              />
            ))}
          </div>
        </div>
      )}

      {/* WAGES TAB */}
      {tab === "wages" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Total Wages</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatPHP(wagesTotal)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Pending</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">{formatPHP(wagesPending)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Paid</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{formatPHP(wagesPaid)}</p>
            </div>
          </div>

          <WageForm onSubmit={handleAddWage} />

          <div className="flex gap-2 mb-4">
            {["all", "pending", "paid"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filter === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {wagesFiltered.map((wage) => (
              <ItemCard
                key={wage.id}
                item={wage}
                type="wages"
                title={wage.employeeName}
                onDelete={() => handleDelete("wages", wage.id)}
                onMarkPaid={() => handleMarkPaid("wages", wage)}
                fields={[wage.dueDate ? `Due: ${formatDate(wage.dueDate)}` : "", wage.paymentMethod ? `Method: ${wage.paymentMethod}` : "", formatDate(wage.payDate)]}
              />
            ))}
          </div>
        </div>
      )}

      {/* INCOME TAB */}
      {tab === "income" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Total Income</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatPHP(incomesTotal)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Pending</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">{formatPHP(incomesPending)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Received</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{formatPHP(incomesPaid)}</p>
            </div>
          </div>

          <IncomeForm onSubmit={handleAddIncome} />

          <div className="flex gap-2 mb-4">
            {["all", "pending", "paid"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filter === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {incomesFiltered.map((income) => (
              <ItemCard
                key={income.id}
                item={income}
                type="incomes"
                onDelete={() => handleDelete("incomes", income.id)}
                onMarkPaid={() => handleMarkPaid("incomes", income)}
                fields={[income.source ? `Source: ${income.source}` : "", income.paymentMethod ? `Method: ${income.paymentMethod}` : "", formatDate(income.incomeDate)]}
              />
            ))}
          </div>
        </div>
      )}

      {/* EXPENSES TAB */}
      {tab === "expenses" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Total Expenses</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatPHP(expensesTotal)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Pending</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">{formatPHP(expensesPending)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Paid</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{formatPHP(expensesPaid)}</p>
            </div>
          </div>

          <ExpenseForm onSubmit={handleAddExpense} />

          <div className="flex gap-2 mb-4">
            {["all", "pending", "paid"].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filter === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {expensesSortedByUpcoming.map((expense) => (
              <ItemCard
                key={expense.id}
                item={expense}
                type="expenses"
                onDelete={() => handleDelete("expenses", expense.id)}
                onMarkPaid={() => handleMarkPaid("expenses", expense)}
                fields={[expense.dueDate ? `Due: ${formatDate(expense.dueDate)}` : "", expense.category, expense.paymentMethod ? `Method: ${expense.paymentMethod}` : "", formatDate(expense.expenseDate)]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BillForm({ onSubmit }: { onSubmit: (e: React.FormEvent, data: any) => void }) {
  const [form, setForm] = useState({
    description: "",
    amount: "",
    billDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    paymentMethod: "",
    category: "",
    notes: "",
  });

  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Add Bill</h2>
      <form
        onSubmit={(e) => {
          onSubmit(e, {
            description: form.description,
            amount: parseInt(form.amount),
            billDate: form.billDate,
            dueDate: form.dueDate || null,
            paymentMethod: form.paymentMethod,
            category: form.category,
            notes: form.notes,
          });
          setForm({ description: "", amount: "", billDate: new Date().toISOString().split("T")[0], dueDate: "", paymentMethod: "", category: "", notes: "" });
        }}
        className="space-y-3"
      >
        <input
          type="text"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input w-full"
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Amount (₱)"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="input"
            required
          />
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-gray-500 uppercase">Bill Date</p>
            <input
              type="date"
              value={form.billDate}
              onChange={(e) => setForm({ ...form, billDate: e.target.value })}
              className="input"
              required
            />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-gray-500 uppercase">Due Date</p>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="input"
            />
          </div>
          <input
            type="text"
            placeholder="Payment Method"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            className="input"
          />
          <input
            type="text"
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="input"
          />
        </div>
        <textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="input w-full"
          rows={2}
        />
        <button type="submit" className="btn-primary w-full">
          Add Bill
        </button>
      </form>
    </div>
  );
}

function WageForm({ onSubmit }: { onSubmit: (e: React.FormEvent, data: any) => void }) {
  const [form, setForm] = useState({
    employeeName: "",
    amount: "",
    payDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    paymentMethod: "",
    notes: "",
  });

  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Add Wage</h2>
      <form
        onSubmit={(e) => {
          onSubmit(e, {
            employeeName: form.employeeName,
            amount: parseInt(form.amount),
            payDate: form.payDate,
            dueDate: form.dueDate || null,
            paymentMethod: form.paymentMethod,
            notes: form.notes,
          });
          setForm({ employeeName: "", amount: "", payDate: new Date().toISOString().split("T")[0], dueDate: "", paymentMethod: "", notes: "" });
        }}
        className="space-y-3"
      >
        <input
          type="text"
          placeholder="Employee Name"
          value={form.employeeName}
          onChange={(e) => setForm({ ...form, employeeName: e.target.value })}
          className="input w-full"
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Amount (₱)"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="input"
            required
          />
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-gray-500 uppercase">Pay Date</p>
            <input
              type="date"
              value={form.payDate}
              onChange={(e) => setForm({ ...form, payDate: e.target.value })}
              className="input"
              required
            />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-gray-500 uppercase">Due Date</p>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="input"
            />
          </div>
          <input
            type="text"
            placeholder="Payment Method"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            className="input"
          />
        </div>
        <textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="input w-full"
          rows={2}
        />
        <button type="submit" className="btn-primary w-full">
          Add Wage
        </button>
      </form>
    </div>
  );
}

function ExpenseForm({ onSubmit }: { onSubmit: (e: React.FormEvent, data: any) => void }) {
  const [form, setForm] = useState({
    description: "",
    amount: "",
    expenseDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    category: "",
    paymentMethod: "",
    notes: "",
  });

  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Add Expense</h2>
      <form
        onSubmit={(e) => {
          onSubmit(e, {
            description: form.description,
            amount: parseFloat(form.amount),
            expenseDate: form.expenseDate,
            dueDate: form.dueDate || null,
            category: form.category,
            paymentMethod: form.paymentMethod,
            notes: form.notes,
          });
          setForm({ description: "", amount: "", expenseDate: new Date().toISOString().split("T")[0], dueDate: "", category: "", paymentMethod: "", notes: "" });
        }}
        className="space-y-3"
      >
        <input
          type="text"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input w-full"
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="0.01"
            placeholder="Amount (₱)"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="input"
            required
          />
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-gray-500 uppercase">Expense Date</p>
            <input
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              className="input"
              required
            />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-gray-500 uppercase">Due Date</p>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="input"
            />
          </div>
          <input
            type="text"
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="input"
          />
          <input
            type="text"
            placeholder="Payment Method"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            className="input"
          />
        </div>
        <textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="input w-full"
          rows={2}
        />
        <button type="submit" className="btn-primary w-full">
          Add Expense
        </button>
      </form>
    </div>
  );
}

function IncomeForm({ onSubmit }: { onSubmit: (e: React.FormEvent, data: any) => void }) {
  const [form, setForm] = useState({
    description: "",
    source: "Airbnb",
    amount: "",
    incomeDate: new Date().toISOString().split("T")[0],
    paymentMethod: "",
    notes: "",
  });

  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Add Income</h2>
      <form
        onSubmit={(e) => {
          onSubmit(e, {
            description: form.description,
            source: form.source,
            amount: parseFloat(form.amount),
            incomeDate: form.incomeDate,
            paymentMethod: form.paymentMethod,
            notes: form.notes,
          });
          setForm({ description: "", source: "Airbnb", amount: "", incomeDate: new Date().toISOString().split("T")[0], paymentMethod: "", notes: "" });
        }}
        className="space-y-3"
      >
        <input
          type="text"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input w-full"
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="0.01"
            placeholder="Amount (₱)"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="input"
            required
          />
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-gray-500 uppercase">Income Date</p>
            <input
              type="date"
              value={form.incomeDate}
              onChange={(e) => setForm({ ...form, incomeDate: e.target.value })}
              className="input"
              required
            />
          </div>
          <input
            type="text"
            placeholder="Source (e.g., Airbnb)"
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            className="input"
          />
          <input
            type="text"
            placeholder="Payment Method"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            className="input"
          />
        </div>
        <textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="input w-full"
          rows={2}
        />
        <button type="submit" className="btn-primary w-full">
          Add Income
        </button>
      </form>
    </div>
  );
}

function ItemCard({
  item,
  type,
  title,
  onDelete,
  onMarkPaid,
  fields,
}: {
  item: any;
  type: string;
  title?: string;
  onDelete: () => void;
  onMarkPaid: () => void;
  fields: string[];
}) {
  const displayFields = fields.filter((f) => f && f.trim().length > 0);

  return (
    <div className="card p-3 flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-semibold text-gray-900">{title || item.description}</p>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              item.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {item.status}
          </span>
        </div>
        <p className="text-xs text-gray-500">{displayFields.join(" • ")}</p>
        {item.notes && <p className="text-xs text-gray-600 mt-1">{item.notes}</p>}
      </div>
      <div className="flex items-center gap-2 ml-4">
        <p className="font-bold text-gray-900 text-lg">{formatPHP(item.amount)}</p>
        {item.status === "pending" && (
          <button onClick={onMarkPaid} className="btn-secondary text-xs py-1 px-2">
            <CheckCircle className="w-4 h-4" />
          </button>
        )}
        <button onClick={onDelete} className="btn-secondary text-xs py-1 px-2 text-red-600">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
