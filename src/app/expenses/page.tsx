"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { formatPHP, formatDate } from "@/lib/utils";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");
  const [monthlyValue, setMonthlyValue] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [newExpense, setNewExpense] = useState({ description: "", amount: "", expenseDate: "", category: "", paymentMethod: "", notes: "" });

  const fetchExpenses = async () => {
    try {
      const url = filter === "all" ? "/api/expenses" : `/api/expenses?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      setExpenses(data);
    } catch (e) {
      console.error("Failed to load expenses:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchExpenses(); }, [filter]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.description || !newExpense.amount || !newExpense.expenseDate) return;

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newExpense.description,
          amount: parseFloat(newExpense.amount),
          expenseDate: newExpense.expenseDate,
          category: newExpense.category,
          paymentMethod: newExpense.paymentMethod,
          notes: newExpense.notes,
        }),
      });
      if (res.ok) {
        setNewExpense({ description: "", amount: "", expenseDate: "", category: "", paymentMethod: "", notes: "" });
        fetchExpenses();
      }
    } catch (e) {
      console.error("Failed to add expense:", e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      fetchExpenses();
    } catch (e) {
      console.error("Failed to delete expense:", e);
    }
  };

  const handleMarkPaid = async (expense: any) => {
    try {
      await fetch(`/api/expenses/${expense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...expense, status: "paid" }),
      });
      fetchExpenses();
    } catch (e) {
      console.error("Failed to update expense:", e);
    }
  };

  const shiftMonth = (months: number) => {
    const d = new Date(`${monthlyValue}-01`);
    d.setMonth(d.getMonth() + months);
    setMonthlyValue(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

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

  const expensesInMonth = expenses.filter((e) => inSelectedMonth(e.expenseDate));
  const filteredExpenses = expensesInMonth.filter((e) => filter === "all" ? true : e.status === filter);
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    const aDate = new Date(a.dueDate ?? a.expenseDate).getTime();
    const bDate = new Date(b.dueDate ?? b.expenseDate).getTime();
    if (aDate !== bDate) return aDate - bDate;
    return a.id - b.id;
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  const totalPending = filteredExpenses.filter((e) => e.status === "pending").reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const totalPaid = filteredExpenses.filter((e) => e.status === "paid").reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Expenses Tracking</h1>
        <Link href="/" className="text-xs text-blue-600 hover:underline">← Back to Dashboard</Link>
      </div>

      {/* Month Picker */}
      <div className="card p-4 bg-gradient-to-r from-slate-50 to-slate-100">
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={() => shiftMonth(-1)} className="btn-secondary text-xs py-2 px-3">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="month"
            className="input py-2 text-sm w-auto border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            value={monthlyValue}
            onChange={(e) => setMonthlyValue(e.target.value)}
          />
          <button type="button" onClick={() => shiftMonth(1)} className="btn-secondary text-xs py-2 px-3">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-700 ml-auto">
            {monthStart.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Total Expenses (This Month)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatPHP(filteredExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0))}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Pending</p>
          <p className="text-2xl font-bold text-yellow-700 mt-1">{formatPHP(totalPending)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Paid</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{formatPHP(totalPaid)}</p>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add New Expense</h2>
        <form onSubmit={handleAddExpense} className="space-y-3">
          <input type="text" placeholder="Description" value={newExpense.description} onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })} className="input w-full" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="0.01" placeholder="Amount (₱)" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} className="input" />
            <input type="date" value={newExpense.expenseDate} onChange={(e) => setNewExpense({ ...newExpense, expenseDate: e.target.value })} className="input" />
            <input type="text" placeholder="Category" value={newExpense.category} onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })} className="input" />
            <input type="text" placeholder="Payment Method" value={newExpense.paymentMethod} onChange={(e) => setNewExpense({ ...newExpense, paymentMethod: e.target.value })} className="input" />
          </div>
          <textarea placeholder="Notes" value={newExpense.notes} onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })} className="input w-full" rows={2} />
          <button type="submit" className="btn-primary">Add Expense</button>
        </form>
      </div>

      <div className="flex gap-2 mb-4">
        {["all", "pending", "paid"].map((s) => (
          <button key={s} onClick={() => setFilter(s as any)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Month Display for Records */}
      <div className="flex items-center justify-between mb-3 px-2">
        <p className="text-sm font-semibold text-gray-700">
          Records for {monthStart.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}
        </p>
        <p className="text-xs text-gray-500">
          {filteredExpenses.length} record{filteredExpenses.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="space-y-2">
        {sortedExpenses.map((expense) => (
          <div key={expense.id} className="card p-3 flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-gray-900">{expense.description}</p>
                <span className={`text-xs px-2 py-0.5 rounded ${expense.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{expense.status}</span>
              </div>
              <p className="text-xs text-gray-500">{expense.category} • {formatDate(expense.expenseDate)}</p>
              {expense.paymentMethod && <p className="text-xs text-gray-400">Method: {expense.paymentMethod}</p>}
              {expense.notes && <p className="text-xs text-gray-600 mt-1">{expense.notes}</p>}
            </div>
            <div className="flex items-center gap-2 ml-4">
              <p className="font-bold text-gray-900 text-lg">{formatPHP(expense.amount)}</p>
              {expense.status === "pending" && (
                <button onClick={() => handleMarkPaid(expense)} className="btn-secondary text-xs py-1 px-2">
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => handleDelete(expense.id)} className="btn-secondary text-xs py-1 px-2 text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
