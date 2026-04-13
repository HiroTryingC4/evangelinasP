"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, CheckCircle } from "lucide-react";
import { formatPHP, formatDate } from "@/lib/utils";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  const totalPending = expenses.filter((e) => e.status === "pending").reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const totalPaid = expenses.filter((e) => e.status === "paid").reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const sortedExpenses = [...expenses].sort((a, b) => {
    const aDate = new Date(a.dueDate ?? a.expenseDate).getTime();
    const bDate = new Date(b.dueDate ?? b.expenseDate).getTime();
    if (aDate !== bDate) return aDate - bDate;
    return a.id - b.id;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Expenses Tracking</h1>
        <Link href="/" className="text-xs text-blue-600 hover:underline">← Back to Dashboard</Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Total Expenses</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatPHP(expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0))}</p>
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
