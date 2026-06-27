"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, CheckCircle, ChevronLeft, ChevronRight, Edit2, TrendingUp, TrendingDown, DollarSign, Wallet, PieChart, MessageSquareText } from "lucide-react";
import { formatPHP, formatDate, formatWeekRange, normalizeUnitCode, UNITS } from "@/lib/utils";
import BillsChecklist from "@/components/BillsChecklist";

const MONTHLY_NET_UNITS = new Set(["1116", "1118", "1558", "1845", "2045"]);

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toArray<T>(value: T[] | null | undefined | unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export default function FinancesPage() {
  const [tab, setTab] = useState<"bills" | "wages" | "income" | "expenses" | "transfer">("bills");
  const [units, setUnits] = useState<string[]>(UNITS);
  const [selectedRevenueUnits, setSelectedRevenueUnits] = useState<string[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [wages, setWages] = useState<any[]>([]);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");
  const [weeklyDate, setWeeklyDate] = useState(() => toYMD(new Date()));
  const [monthlyValue, setMonthlyValue] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteData, setDeleteData] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.units) && d.units.length > 0) setUnits(d.units);
        })
        .catch(() => {}),
      fetch("/api/bookings").then((r) => r.json()).then((d) => setBookings(toArray(d))),
      fetch("/api/bills").then((r) => r.json()).then((d) => setBills(toArray(d))),
      fetch("/api/wages").then((r) => r.json()).then((d) => setWages(toArray(d))),
      fetch("/api/income")
        .then((r) => r.json())
        .then((d) => setIncomes(toArray(d))),
      fetch("/api/expenses").then((r) => r.json()).then((d) => setExpenses(toArray(d))),
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
      setBills(toArray(await res.json()));
      
      // Show confirmation modal
      setConfirmationData({ type: "Bill", ...data });
      setShowConfirmation(true);
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
      setWages(toArray(await res.json()));
      
      // Show confirmation modal
      setConfirmationData({ type: "Wage", ...data });
      setShowConfirmation(true);
    } catch (e) {
      console.error("Failed to add wage:", e);
    }
  };

  const handleAddExpense = async (data: any) => {
    try {
      await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const res = await fetch("/api/expenses");
      setExpenses(toArray(await res.json()));
      
      // Show confirmation modal
      setConfirmationData({ type: "Expense", ...data });
      setShowConfirmation(true);
    } catch (e) {
      console.error("Failed to add expense:", e);
    }
  };

  const handleAddTransfer = (e: React.FormEvent, data: any) => {
    e.preventDefault();
    setTransfers([...transfers, { id: Date.now(), ...data }]);
    
    // Show confirmation modal
    setConfirmationData({ type: "Transfer", ...data });
    setShowConfirmation(true);
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
      const nextIncomes = await res.json();
      setIncomes(toArray(nextIncomes));
      
      // Show confirmation modal
      setConfirmationData({ type: "Income", ...data });
      setShowConfirmation(true);
    } catch (e) {
      console.error("Failed to add income:", e);
    }
  };

  const handleDelete = async (type: "bills" | "wages" | "incomes" | "expenses" | "transfer", id: number) => {
    // Find the item to show in confirmation
    let itemToDelete: any = null;
    if (type === "bills") itemToDelete = bills.find(b => b.id === id);
    else if (type === "wages") itemToDelete = wages.find(w => w.id === id);
    else if (type === "incomes") itemToDelete = incomes.find(i => i.id === id);
    else if (type === "expenses") itemToDelete = expenses.find(e => e.id === id);
    else if (type === "transfer") itemToDelete = transfers.find(t => t.id === id);

    // Show delete confirmation modal
    setDeleteData({ type, id, item: itemToDelete });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteData) return;
    
    const { type, id, item } = deleteData;
    
    try {
      if (type === "transfer") {
        setTransfers(transfers.filter((t) => t.id !== id));
      } else {
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
      }
      
      // Close delete confirm and show success
      setShowDeleteConfirm(false);
      setConfirmationData({ 
        type: type === "incomes" ? "Income" : type === "bills" ? "Bill" : type === "wages" ? "Wage" : type === "expenses" ? "Expense" : "Transfer",
        action: "deleted",
        ...item 
      });
      setShowConfirmation(true);
      setDeleteData(null);
    } catch (e) {
      console.error("Failed to delete:", e);
      setShowDeleteConfirm(false);
      setDeleteData(null);
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

  const handleToggleStatus = async (type: "bills" | "wages" | "incomes" | "expenses", item: any) => {
    try {
      const apiType = type === "incomes" ? "income" : type;
      const newStatus = item.status === "paid" ? "pending" : "paid";
      const updateData = { ...item, status: newStatus };
      if (newStatus === "paid") {
        updateData.paidDate = new Date().toISOString().split("T")[0];
      }
      
      await fetch(`/api/${apiType}/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      
      const updatedItem = { ...item, status: newStatus };
      if (type === "bills") {
        setBills(bills.map((b) => (b.id === item.id ? updatedItem : b)));
      } else if (type === "wages") {
        setWages(wages.map((w) => (w.id === item.id ? updatedItem : w)));
      } else if (type === "incomes") {
        setIncomes(incomes.map((i) => (i.id === item.id ? updatedItem : i)));
      } else {
        setExpenses(expenses.map((e) => (e.id === item.id ? updatedItem : e)));
      }
    } catch (e) {
      console.error("Failed to toggle status:", e);
    }
  };

  const handleEdit = async (type: "bills" | "wages" | "incomes" | "expenses", updatedItem: any) => {
    try {
      const apiType = type === "incomes" ? "income" : type;
      await fetch(`/api/${apiType}/${updatedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedItem),
      });
      
      if (type === "bills") {
        setBills(bills.map((b) => (b.id === updatedItem.id ? updatedItem : b)));
      } else if (type === "wages") {
        setWages(wages.map((w) => (w.id === updatedItem.id ? updatedItem : w)));
      } else if (type === "incomes") {
        setIncomes(incomes.map((i) => (i.id === updatedItem.id ? updatedItem : i)));
      } else {
        setExpenses(expenses.map((e) => (e.id === updatedItem.id ? updatedItem : e)));
      }
    } catch (e) {
      console.error("Failed to update item:", e);
    }
  };

  const handleAmountChange = async (type: "bills" | "wages" | "incomes" | "expenses", item: any, newAmount: number) => {
    try {
      const apiType = type === "incomes" ? "income" : type;
      await fetch(`/api/${apiType}/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, amount: newAmount }),
      });
      
      const updatedItem = { ...item, amount: newAmount };
      if (type === "bills") {
        setBills(bills.map((b) => (b.id === item.id ? updatedItem : b)));
      } else if (type === "wages") {
        setWages(wages.map((w) => (w.id === item.id ? updatedItem : w)));
      } else if (type === "incomes") {
        setIncomes(incomes.map((i) => (i.id === item.id ? updatedItem : i)));
      } else {
        setExpenses(expenses.map((e) => (e.id === item.id ? updatedItem : e)));
      }
    } catch (e) {
      console.error("Failed to update amount:", e);
    }
  };

  const getFilteredData = (data: any[]) => filter === "all" ? data : data.filter((d) => d.status === filter);

  // Temporary placeholders - will be defined after inSelectedMonth
  let billsFiltered: any[] = [];
  let wagesFiltered: any[] = [];
  let incomesFiltered: any[] = [];
  let expensesFiltered: any[] = [];
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
    ? bookings.filter((b) => selectedRevenueUnits.includes(normalizeUnitCode(b.unit)))
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

  // Now apply both status filter and month filter
  const getMonthFilteredData = (data: any[], dateField: "billDate" | "payDate" | "incomeDate" | "expenseDate") => {
    return data.filter((item) => {
      const statusMatch = filter === "all" ? true : item.status === filter;
      const monthMatch = inSelectedMonth(item[dateField]);
      return statusMatch && monthMatch;
    });
  };

  billsFiltered = getMonthFilteredData(bills, "billDate");
  wagesFiltered = getMonthFilteredData(wages, "payDate");
  incomesFiltered = getMonthFilteredData(incomes, "incomeDate");
  expensesFiltered = getMonthFilteredData(expenses, "expenseDate");

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

  const monthlyBookingRevenue = bookings
    .filter((b) => MONTHLY_NET_UNITS.has(normalizeUnitCode(b.unit)))
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
              <p className="text-[11px] text-gray-400 mt-0.5">Revenue scope below applies to weekly net only.</p>
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

      <details className="card p-0 overflow-hidden">
        <summary className="cursor-pointer list-none bg-gradient-to-r from-slate-50 to-slate-100 p-4 sm:p-5 hover:from-slate-100 hover:to-slate-150 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">📊 Monthly Totals</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {monthStart.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="hidden sm:flex text-xs text-gray-400">Click to expand</div>
          </div>
        </summary>

        <div className="p-4 sm:p-6 space-y-6 bg-gradient-to-b from-white to-gray-50">
          {/* Month Selector */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Select Month:</label>
            <input
              type="month"
              className="input py-2 text-sm w-auto border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              value={monthlyValue}
              onChange={(e) => setMonthlyValue(e.target.value)}
            />
          </div>

          {/* Revenue Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Revenue</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="group rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-400 to-blue-500 p-4 sm:p-5 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs opacity-90 uppercase tracking-wide font-semibold">Monthly Revenue</p>
                    <p className="text-sm opacity-75 mt-0.5">(Units 1116, 1118, 1558, 1845 + External)</p>
                  </div>
                  <DollarSign className="w-5 h-5 opacity-80" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold">{formatPHP(monthlyRevenue)}</p>
              </div>
              <div className="group rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-400 to-teal-500 p-4 sm:p-5 text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs opacity-90 uppercase tracking-wide font-semibold">External Income</p>
                    <p className="text-sm opacity-75 mt-0.5">This month</p>
                  </div>
                  <Wallet className="w-5 h-5 opacity-80" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold">{formatPHP(monthlyIncomeTotal)}</p>
              </div>
            </div>
          </div>

          {/* Costs Breakdown Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Cost Breakdown</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 p-4 sm:p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Bills</p>
                  <span className="text-xl font-bold text-red-600">📋</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-red-700">{formatPHP(monthlyBillsTotal)}</p>
                <p className="text-[11px] text-red-600 mt-1 opacity-75">Monthly utilities & obligations</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 p-4 sm:p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Wages</p>
                  <span className="text-xl font-bold text-blue-600">👤</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-blue-700">{formatPHP(monthlyWagesTotal)}</p>
                <p className="text-[11px] text-blue-600 mt-1 opacity-75">Employee salaries</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 p-4 sm:p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Expenses</p>
                  <span className="text-xl font-bold text-purple-600">💰</span>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-purple-700">{formatPHP(monthlyExpensesTotal)}</p>
                <p className="text-[11px] text-purple-600 mt-1 opacity-75">Operations & supplies</p>
              </div>
            </div>
          </div>

          {/* Total Costs */}
          <div className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-4 sm:p-5 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs opacity-80 uppercase tracking-wide font-semibold">Total Monthly Costs</p>
                <p className="text-sm opacity-70 mt-0.5">Bills + Wages + Expenses</p>
              </div>
              <PieChart className="w-6 h-6 opacity-60" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold mt-3">{formatPHP(monthlyCostsTotal)}</p>
          </div>

          {/* Net Profit/Loss */}
          <div className={`rounded-xl p-4 sm:p-5 border-2 shadow-lg transition-all ${
            monthlyNetAfterCosts >= 0 
              ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-300 hover:shadow-xl' 
              : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-300 hover:shadow-xl'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {monthlyNetAfterCosts >= 0 ? (
                  <TrendingUp className={`w-6 h-6 ${monthlyNetAfterCosts >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-600" />
                )}
                <p className={`text-sm font-bold uppercase tracking-wide ${monthlyNetAfterCosts >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>
                  Monthly Net (Revenue - Costs)
                </p>
              </div>
              <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${
                monthlyNetAfterCosts >= 0 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-red-500 text-white'
              }`}>
                {getNetLabel(monthlyNetAfterCosts)}
              </span>
            </div>
            <p className={`text-3xl sm:text-4xl font-bold ${monthlyNetAfterCosts >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {formatPHP(monthlyNetAfterCosts)}
            </p>
            <div className="mt-3 p-3 rounded-lg bg-white/50 backdrop-blur-sm">
              <p className={`text-xs ${monthlyNetAfterCosts >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {monthlyNetAfterCosts >= 0 
                  ? `Great work! You have ₱${Math.abs(monthlyNetAfterCosts)} profit this month.`
                  : `Alert: You have a loss of ₱${Math.abs(monthlyNetAfterCosts)} this month.`
                }
              </p>
            </div>
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
        <button
          onClick={() => setTab("transfer")}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
            tab === "transfer"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          }`}
        >
          Transfer
        </button>
      </div>

      {/* BILLS TAB */}
      {tab === "bills" && (
        <div className="space-y-4">
          <BillsChecklist />
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Total Bills</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatPHP(billsFiltered.reduce((s, b) => s + b.amount, 0))}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Pending</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">{formatPHP(billsFiltered.filter(b => b.status === "pending").reduce((s, b) => s + b.amount, 0))}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Paid</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{formatPHP(billsFiltered.filter(b => b.status === "paid").reduce((s, b) => s + b.amount, 0))}</p>
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
                onEdit={(updatedBill) => handleEdit("bills", updatedBill)}
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
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatPHP(wagesFiltered.reduce((s, w) => s + w.amount, 0))}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Pending</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">{formatPHP(wagesFiltered.filter(w => w.status === "pending").reduce((s, w) => s + w.amount, 0))}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Paid</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{formatPHP(wagesFiltered.filter(w => w.status === "paid").reduce((s, w) => s + w.amount, 0))}</p>
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
                onEdit={(updatedWage) => handleEdit("wages", updatedWage)}
                fields={[wage.paymentMethod ? `Method: ${wage.paymentMethod}` : "", formatDate(wage.payDate)]}
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
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatPHP(incomesFiltered.reduce((s, i) => s + Number(i.amount || 0), 0))}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Pending</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">{formatPHP(incomesFiltered.filter(i => i.status === "pending").reduce((s, i) => s + Number(i.amount || 0), 0))}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Received</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{formatPHP(incomesFiltered.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount || 0), 0))}</p>
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
                onEdit={(updatedIncome) => handleEdit("incomes", updatedIncome)}
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
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatPHP(expensesFiltered.reduce((s, e) => s + Number(e.amount || 0), 0))}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Pending</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">{formatPHP(expensesFiltered.filter(e => e.status === "pending").reduce((s, e) => s + Number(e.amount || 0), 0))}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 uppercase">Paid</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{formatPHP(expensesFiltered.filter(e => e.status === "paid").reduce((s, e) => s + Number(e.amount || 0), 0))}</p>
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
                onEdit={(updatedExpense) => handleEdit("expenses", updatedExpense)}
                fields={[expense.category, expense.paymentMethod ? `Method: ${expense.paymentMethod}` : "", formatDate(expense.expenseDate)]}
              />
            ))}
          </div>
        </div>
      )}

      {/* TRANSFER TAB */}
      {tab === "transfer" && (
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase">Total Transfers Recorded</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatPHP(transfers.reduce((s, t) => s + t.amount, 0))}</p>
          </div>

          <TransferForm onSubmit={handleAddTransfer} />

          <div className="space-y-3">
            {transfers.length > 0 ? (
              transfers.map((transfer) => (
                <TransferCard
                  key={transfer.id}
                  transfer={transfer}
                  onDelete={() => handleDelete("transfer", transfer.id)}
                />
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No transfers recorded yet</p>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && confirmationData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-slideIn">
            {/* Header */}
            <div className={`text-white px-6 py-4 rounded-t-xl ${
              confirmationData.action === "deleted" 
                ? "bg-gradient-to-r from-red-500 to-pink-500" 
                : "bg-gradient-to-r from-green-500 to-emerald-500"
            }`}>
              <h2 className="text-lg font-bold">
                {confirmationData.action === "deleted" ? "🗑️" : "✅"} {confirmationData.type} {confirmationData.action === "deleted" ? "Deleted" : "Added"} Successfully!
              </h2>
              <p className="text-xs opacity-90 mt-0.5">
                Your {confirmationData.type.toLowerCase()} has been {confirmationData.action === "deleted" ? "removed" : "recorded"}
              </p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-3">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-gray-600 uppercase">
                    {confirmationData.type === "Wage" ? "Employee" : "Description"}
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {confirmationData.description || confirmationData.employeeName}
                  </span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-gray-600 uppercase">Amount</span>
                  <span className={`text-lg font-bold ${
                    confirmationData.action === "deleted" ? "text-red-600" : "text-green-600"
                  }`}>
                    {formatPHP(confirmationData.amount)}
                  </span>
                </div>
                {confirmationData.category && (
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-gray-600 uppercase">Category</span>
                    <span className="text-sm text-gray-900">{confirmationData.category}</span>
                  </div>
                )}
                {confirmationData.source && (
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-gray-600 uppercase">Source</span>
                    <span className="text-sm text-gray-900">{confirmationData.source}</span>
                  </div>
                )}
                {confirmationData.paymentMethod && (
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-gray-600 uppercase">Payment Method</span>
                    <span className="text-sm text-gray-900">{confirmationData.paymentMethod}</span>
                  </div>
                )}
                {confirmationData.notes && (
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-xs font-semibold text-gray-600 uppercase block mb-1">Notes</span>
                    <span className="text-sm text-gray-700">{confirmationData.notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex items-center justify-end">
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  setConfirmationData(null);
                }}
                className={`text-white font-bold py-2 px-6 rounded-lg transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg ${
                  confirmationData.action === "deleted"
                    ? "bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600"
                    : "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                }`}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-slideIn">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-4 rounded-t-xl">
              <h2 className="text-lg font-bold">⚠️ Confirm Deletion</h2>
              <p className="text-xs opacity-90 mt-0.5">This action cannot be undone</p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-3">
              <p className="text-gray-700">
                Are you sure you want to delete this {deleteData.type === "incomes" ? "income" : deleteData.type === "bills" ? "bill" : deleteData.type === "wages" ? "wage" : deleteData.type === "expenses" ? "expense" : "transfer"}?
              </p>
              
              {deleteData.item && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-red-700 uppercase">
                      {deleteData.type === "wages" ? "Employee" : "Description"}
                    </span>
                    <span className="text-sm font-bold text-red-900">
                      {deleteData.item.description || deleteData.item.employeeName}
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-red-700 uppercase">Amount</span>
                    <span className="text-lg font-bold text-red-900">
                      {formatPHP(deleteData.item.amount)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteData(null);
                }}
                className="btn-secondary py-2 px-4"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold py-2 px-6 rounded-lg hover:from-red-600 hover:to-pink-600 transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Delete
              </button>
            </div>
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
    paymentMethod: "",
    category: "",
    notes: "",
  });

  return (
    <div className="card p-5 border-2 border-red-100 shadow-lg hover:shadow-xl transition-all duration-300">
      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-3 rounded-lg mb-4 shadow-md">
        <h2 className="text-base font-bold">💳 Add Bill</h2>
        <p className="text-xs opacity-90 mt-0.5">Record a new bill or payment obligation</p>
      </div>
      <form
        onSubmit={(e) => {
          onSubmit(e, {
            description: form.description,
            amount: parseInt(form.amount),
            billDate: form.billDate,
            dueDate: null,
            paymentMethod: form.paymentMethod,
            category: form.category,
            notes: form.notes,
          });
          setForm({ description: "", amount: "", billDate: new Date().toISOString().split("T")[0], paymentMethod: "", category: "", notes: "" });
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Description <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g., Electricity Bill, Water Bill"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input w-full focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Amount (₱) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Bill Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.billDate}
              onChange={(e) => setForm({ ...form, billDate: e.target.value })}
              className="input focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Payment Method
            </label>
            <input
              type="text"
              placeholder="e.g., GCash, Bank"
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              className="input focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Category
          </label>
          <input
            type="text"
            placeholder="e.g., Utilities, Rent"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="input w-full focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Notes
          </label>
          <textarea
            placeholder="Additional details..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input w-full focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
            rows={2}
          />
        </div>

        <button 
          type="submit" 
          className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold py-3 px-4 rounded-lg hover:from-red-600 hover:to-orange-600 transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg"
        >
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
    paymentMethod: "",
    notes: "",
  });

  return (
    <div className="card p-5 border-2 border-blue-100 shadow-lg hover:shadow-xl transition-all duration-300">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-3 rounded-lg mb-4 shadow-md">
        <h2 className="text-base font-bold">👤 Add Wage</h2>
        <p className="text-xs opacity-90 mt-0.5">Record employee salary or wage payment</p>
      </div>
      <form
        onSubmit={(e) => {
          onSubmit(e, {
            employeeName: form.employeeName,
            amount: parseInt(form.amount),
            payDate: form.payDate,
            dueDate: null,
            paymentMethod: form.paymentMethod,
            notes: form.notes,
          });
          setForm({ employeeName: "", amount: "", payDate: new Date().toISOString().split("T")[0], paymentMethod: "", notes: "" });
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Employee Name <span className="text-blue-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g., John Doe"
            value={form.employeeName}
            onChange={(e) => setForm({ ...form, employeeName: e.target.value })}
            className="input w-full focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Amount (₱) <span className="text-blue-500">*</span>
            </label>
            <input
              type="number"
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Pay Date <span className="text-blue-500">*</span>
            </label>
            <input
              type="date"
              value={form.payDate}
              onChange={(e) => setForm({ ...form, payDate: e.target.value })}
              className="input focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Payment Method
            </label>
            <input
              type="text"
              placeholder="e.g., GCash, Bank"
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              className="input focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Notes
          </label>
          <textarea
            placeholder="Additional details..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input w-full focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
            rows={2}
          />
        </div>

        <button 
          type="submit" 
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold py-3 px-4 rounded-lg hover:from-blue-600 hover:to-indigo-600 transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg"
        >
          Add Wage
        </button>
      </form>
    </div>
  );
}

function ExpenseForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [form, setForm] = useState({
    description: "",
    amount: "",
    expenseDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    category: "",
    paymentMethod: "",
    notes: "",
  });
  const today = new Date().toISOString().split("T")[0];

  const handleNightClean = async () => {
    await onSubmit({
      description: "Clean Night",
      amount: 300,
      expenseDate: today,
      category: "",
      paymentMethod: "",
      notes: "",
    });
  };

  return (
    <div className="card p-5 border-2 border-purple-100 shadow-lg hover:shadow-xl transition-all duration-300">
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-3 rounded-lg mb-4 shadow-md flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">💰 Add Expense</h2>
          <p className="text-xs opacity-90 mt-0.5">Record operational expenses</p>
        </div>
        <button 
          type="button" 
          onClick={handleNightClean} 
          className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-xs font-semibold py-2 px-3 rounded-lg transition-all transform hover:scale-105 shadow-md"
        >
          🌙 Night Clean
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            description: form.description,
            amount: parseFloat(form.amount),
            expenseDate: form.expenseDate,
            category: form.category,
            paymentMethod: form.paymentMethod,
            notes: form.notes,
          });
          setForm({ description: "", amount: "", expenseDate: new Date().toISOString().split("T")[0], dueDate: "", category: "", paymentMethod: "", notes: "" });
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Description <span className="text-purple-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g., Office Supplies, Maintenance"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input w-full focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Amount (₱) <span className="text-purple-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Expense Date <span className="text-purple-500">*</span>
            </label>
            <input
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              className="input focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Due Date
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="input focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Category
            </label>
            <input
              type="text"
              placeholder="e.g., Supplies, Repairs"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Payment Method
          </label>
          <input
            type="text"
            placeholder="e.g., Cash, GCash"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            className="input w-full focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Notes
          </label>
          <textarea
            placeholder="Additional details..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input w-full focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all"
            rows={2}
          />
        </div>

        <button 
          type="submit" 
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-3 px-4 rounded-lg hover:from-purple-600 hover:to-pink-600 transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg"
        >
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
    <div className="card p-5 border-2 border-green-100 shadow-lg hover:shadow-xl transition-all duration-300">
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-3 rounded-lg mb-4 shadow-md">
        <h2 className="text-base font-bold">💵 Add Income</h2>
        <p className="text-xs opacity-90 mt-0.5">Record external income sources</p>
      </div>
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
        className="space-y-4"
      >
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Description <span className="text-green-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g., Bonus Payment, Refund"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input w-full focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Amount (₱) <span className="text-green-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Income Date <span className="text-green-500">*</span>
            </label>
            <input
              type="date"
              value={form.incomeDate}
              onChange={(e) => setForm({ ...form, incomeDate: e.target.value })}
              className="input focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Source
            </label>
            <input
              type="text"
              placeholder="e.g., Airbnb, Booking.com"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="input focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Payment Method
            </label>
            <input
              type="text"
              placeholder="e.g., Bank Transfer"
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              className="input focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Notes
          </label>
          <textarea
            placeholder="Additional details..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input w-full focus:ring-2 focus:ring-green-400 focus:border-green-400 transition-all"
            rows={2}
          />
        </div>

        <button 
          type="submit" 
          className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold py-3 px-4 rounded-lg hover:from-green-600 hover:to-emerald-600 transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg"
        >
          Add Income
        </button>
      </form>
    </div>
  );
}

function TransferForm({ onSubmit }: { onSubmit: (e: React.FormEvent, data: any) => void }) {
  const [form, setForm] = useState({
    fromAccount: "",
    toAccount: "",
    amount: "",
    method: "Cash",
    transferDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  return (
    <div className="card p-5 border-2 border-indigo-100 shadow-lg hover:shadow-xl transition-all duration-300">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-3 rounded-lg mb-4 shadow-md">
        <h2 className="text-base font-bold">🔄 Record Transfer</h2>
        <p className="text-xs opacity-90 mt-0.5">Track money movement between accounts</p>
      </div>
      <form
        onSubmit={(e) => {
          onSubmit(e, {
            fromAccount: form.fromAccount,
            toAccount: form.toAccount,
            amount: parseFloat(form.amount),
            method: form.method,
            transferDate: form.transferDate,
            notes: form.notes,
          });
          setForm({ fromAccount: "", toAccount: "", amount: "", method: "Cash", transferDate: new Date().toISOString().split("T")[0], notes: "" });
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              From Account <span className="text-indigo-500">*</span>
            </label>
            <input 
              type="text" 
              placeholder="e.g., GCash" 
              value={form.fromAccount} 
              onChange={(e) => setForm({ ...form, fromAccount: e.target.value })} 
              className="input focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all" 
              required 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              To Account <span className="text-indigo-500">*</span>
            </label>
            <input 
              type="text" 
              placeholder="e.g., Bank" 
              value={form.toAccount} 
              onChange={(e) => setForm({ ...form, toAccount: e.target.value })} 
              className="input focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all" 
              required 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Amount (₱) <span className="text-indigo-500">*</span>
            </label>
            <input 
              type="number" 
              step="0.01" 
              placeholder="0.00" 
              value={form.amount} 
              onChange={(e) => setForm({ ...form, amount: e.target.value })} 
              className="input focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all" 
              required 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Method
            </label>
            <input 
              type="text" 
              placeholder="e.g., Cash, Online" 
              value={form.method} 
              onChange={(e) => setForm({ ...form, method: e.target.value })} 
              className="input focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all" 
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Transfer Date <span className="text-indigo-500">*</span>
          </label>
          <input 
            type="date" 
            value={form.transferDate} 
            onChange={(e) => setForm({ ...form, transferDate: e.target.value })} 
            className="input w-full focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all" 
            required 
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Notes
          </label>
          <textarea 
            placeholder="Additional details..." 
            value={form.notes} 
            onChange={(e) => setForm({ ...form, notes: e.target.value })} 
            className="input w-full focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all" 
            rows={2} 
          />
        </div>

        <button 
          type="submit" 
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold py-3 px-4 rounded-lg hover:from-indigo-600 hover:to-purple-600 transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg"
        >
          Record Transfer
        </button>
      </form>
    </div>
  );
}

function TransferCard({ transfer, onDelete }: { transfer: any; onDelete: () => void }) {
  return (
    <div className="card p-4 sm:p-5 rounded-lg border-2 border-purple-200 shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-lg font-bold text-sm">{transfer.fromAccount}</span>
            <span className="text-gray-400">→</span>
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-lg font-bold text-sm">{transfer.toAccount}</span>
          </div>
          <p className="text-xl font-bold text-purple-900">{formatPHP(transfer.amount)}</p>
          <div className="mt-2 space-y-1 text-xs text-gray-600">
            <p><span className="font-semibold">Method:</span> {transfer.method}</p>
            <p><span className="font-semibold">Date:</span> {formatDate(transfer.transferDate)}</p>
            {transfer.notes && <p><span className="font-semibold">Notes:</span> {transfer.notes}</p>}
          </div>
        </div>
        <button onClick={onDelete} className="btn-secondary text-xs py-2 px-3 text-red-600 hover:bg-red-50 flex-shrink-0 flex items-center gap-1">
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
    </div>
  );
}

function ItemCard({
  item,
  type,
  title,
  onDelete,
  onMarkPaid,
  onEdit,
  fields,
}: {
  item: any;
  type: string;
  title?: string;
  onDelete: () => void;
  onMarkPaid: () => void;
  onEdit: (updatedItem: any) => void;
  fields: string[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    description: item.description || item.employeeName || "",
    amount: String(item.amount),
    status: item.status || "pending",
    category: item.category || "",
    paymentMethod: item.paymentMethod || "",
    notes: item.notes || "",
    billDate: item.billDate ? new Date(item.billDate).toISOString().split("T")[0] : "",
    dueDate: item.dueDate ? new Date(item.dueDate).toISOString().split("T")[0] : "",
    payDate: item.payDate ? new Date(item.payDate).toISOString().split("T")[0] : "",
    expenseDate: item.expenseDate ? new Date(item.expenseDate).toISOString().split("T")[0] : "",
    incomeDate: item.incomeDate ? new Date(item.incomeDate).toISOString().split("T")[0] : "",
    source: item.source || "",
  });

  const displayFields = fields.filter((f) => f && f.trim().length > 0);

  const handleSave = () => {
    const updatedItem = {
      ...item,
      description: editForm.description,
      employeeName: editForm.description,
      amount: parseFloat(editForm.amount) || 0,
      status: editForm.status,
      category: editForm.category || null,
      paymentMethod: editForm.paymentMethod || null,
      notes: editForm.notes || null,
      billDate: editForm.billDate || null,
      dueDate: editForm.dueDate || null,
      payDate: editForm.payDate || null,
      expenseDate: editForm.expenseDate || null,
      incomeDate: editForm.incomeDate || null,
      source: editForm.source || null,
    };
    onEdit(updatedItem);
    setIsEditing(false);
  };

  return (
    <>
      <div className="card p-3 flex items-start justify-between hover:shadow-md transition-shadow">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-gray-900">{title || item.description || item.employeeName}</p>
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                item.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {item.status}
            </span>
          </div>
          <p className="text-xs text-gray-500">{displayFields.join(" • ")}</p>
          {item.notes && (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/80 p-2.5">
              <div className="mt-0.5 rounded-full bg-blue-100 p-1 text-blue-700">
                <MessageSquareText className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Note</p>
                <p className="text-xs leading-5 text-blue-900">{item.notes}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-4">
          <p className="font-bold text-gray-900 text-lg">{formatPHP(item.amount)}</p>
          <button 
            onClick={() => setIsEditing(true)} 
            className="btn-secondary text-xs py-1.5 px-2 flex items-center gap-1 hover:bg-blue-50 transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {item.status === "pending" && (
            <button 
              onClick={onMarkPaid} 
              className="btn-secondary text-xs py-1.5 px-2 hover:bg-green-50 transition-colors"
              title="Mark as paid"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={onDelete} 
            className="btn-secondary text-xs py-1.5 px-2 text-red-600 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideIn">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-4 rounded-t-xl sticky top-0 z-10">
              <h2 className="text-lg font-bold">✏️ Edit {type === "bills" ? "Bill" : type === "wages" ? "Wage" : type === "incomes" ? "Income" : "Expense"}</h2>
              <p className="text-xs opacity-90 mt-0.5">Update the details below</p>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">
              {/* Description/Name */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  {type === "wages" ? "Employee Name" : "Description"} <span className="text-blue-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="input w-full focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                  required
                />
              </div>

              {/* Amount and Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Amount (₱) <span className="text-blue-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                    className="input focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    {type === "bills" ? "Bill Date" : type === "wages" ? "Pay Date" : type === "incomes" ? "Income Date" : "Expense Date"}
                  </label>
                  <input
                    type="date"
                    value={
                      type === "bills" ? editForm.billDate :
                      type === "wages" ? editForm.payDate :
                      type === "incomes" ? editForm.incomeDate :
                      editForm.expenseDate
                    }
                    onChange={(e) => {
                      if (type === "bills") setEditForm({ ...editForm, billDate: e.target.value });
                      else if (type === "wages") setEditForm({ ...editForm, payDate: e.target.value });
                      else if (type === "incomes") setEditForm({ ...editForm, incomeDate: e.target.value });
                      else setEditForm({ ...editForm, expenseDate: e.target.value });
                    }}
                    className="input focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                  />
                </div>
              </div>

              {/* Status and Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="input focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                {type !== "incomes" && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={editForm.dueDate}
                      onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                      className="input focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                    />
                  </div>
                )}
              </div>

              {/* Category and Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                {(type === "bills" || type === "expenses") && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      Category
                    </label>
                    <input
                      type="text"
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="input focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                    />
                  </div>
                )}
                {type === "incomes" && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      Source
                    </label>
                    <input
                      type="text"
                      value={editForm.source}
                      onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                      className="input focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Payment Method
                  </label>
                  <input
                    type="text"
                    value={editForm.paymentMethod}
                    onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                    className="input focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Notes
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="input w-full focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                  rows={3}
                  placeholder="Additional details..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex items-center justify-end gap-3 sticky bottom-0">
              <button
                onClick={() => setIsEditing(false)}
                className="btn-secondary py-2 px-4"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold py-2 px-6 rounded-lg hover:from-blue-600 hover:to-indigo-600 transform hover:scale-[1.02] transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
