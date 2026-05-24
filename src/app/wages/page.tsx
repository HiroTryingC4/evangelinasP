"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { formatPHP, formatDate } from "@/lib/utils";

export default function WagesPage() {
  const [wages, setWages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");
  const [monthlyValue, setMonthlyValue] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [newWage, setNewWage] = useState({ employeeName: "", amount: "", payDate: "", period: "", notes: "" });

  const fetchWages = async () => {
    try {
      const url = filter === "all" ? "/api/wages" : `/api/wages?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      setWages(data);
    } catch (e) {
      console.error("Failed to load wages:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWages(); }, [filter, monthlyValue]);

  const handleAddWage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWage.employeeName || !newWage.amount || !newWage.payDate) return;

    try {
      const res = await fetch("/api/wages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeName: newWage.employeeName,
          amount: parseInt(newWage.amount),
          payDate: newWage.payDate,
          period: newWage.period,
          notes: newWage.notes,
        }),
      });
      if (res.ok) {
        setNewWage({ employeeName: "", amount: "", payDate: "", period: "", notes: "" });
        fetchWages();
      }
    } catch (e) {
      console.error("Failed to add wage:", e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this wage record?")) return;
    try {
      await fetch(`/api/wages/${id}`, { method: "DELETE" });
      fetchWages();
    } catch (e) {
      console.error("Failed to delete wage:", e);
    }
  };

  const handleMarkPaid = async (wage: any) => {
    try {
      await fetch(`/api/wages/${wage.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...wage, status: "paid" }),
      });
      fetchWages();
    } catch (e) {
      console.error("Failed to update wage:", e);
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

  const wagesInMonth = wages.filter((w) => inSelectedMonth(w.payDate));
  const filteredWages = wagesInMonth.filter((w) => filter === "all" ? true : w.status === filter);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  const totalPending = filteredWages.filter((w) => w.status === "pending").reduce((s: number, w: any) => s + w.amount, 0);
  const totalPaid = filteredWages.filter((w) => w.status === "paid").reduce((s: number, w: any) => s + w.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Wages Tracking</h1>
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
          <p className="text-xs text-gray-500 uppercase">Total Wages (This Month)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatPHP(filteredWages.reduce((s: number, w: any) => s + w.amount, 0))}</p>
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
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add New Wage</h2>
        <form onSubmit={handleAddWage} className="space-y-3">
          <input type="text" placeholder="Employee Name" value={newWage.employeeName} onChange={(e) => setNewWage({ ...newWage, employeeName: e.target.value })} className="input w-full" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Amount (₱)" value={newWage.amount} onChange={(e) => setNewWage({ ...newWage, amount: e.target.value })} className="input" />
            <input type="date" value={newWage.payDate} onChange={(e) => setNewWage({ ...newWage, payDate: e.target.value })} className="input" />
            <input type="text" placeholder="Period (e.g., April 2026)" value={newWage.period} onChange={(e) => setNewWage({ ...newWage, period: e.target.value })} className="input" />
          </div>
          <textarea placeholder="Notes" value={newWage.notes} onChange={(e) => setNewWage({ ...newWage, notes: e.target.value })} className="input w-full" rows={2} />
          <button type="submit" className="btn-primary">Add Wage</button>
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
          {filteredWages.length} record{filteredWages.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="space-y-2">
        {filteredWages.map((wage) => (
          <div key={wage.id} className="card p-3 flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-gray-900">{wage.employeeName}</p>
                <span className={`text-xs px-2 py-0.5 rounded ${wage.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{wage.status}</span>
              </div>
              <p className="text-xs text-gray-500">{wage.period} • Pay Date: {formatDate(wage.payDate)}</p>
              {wage.notes && <p className="text-xs text-gray-600 mt-1">{wage.notes}</p>}
            </div>
            <div className="flex items-center gap-2 ml-4">
              <p className="font-bold text-gray-900 text-lg">{formatPHP(wage.amount)}</p>
              {wage.status === "pending" && (
                <button onClick={() => handleMarkPaid(wage)} className="btn-secondary text-xs py-1 px-2">
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => handleDelete(wage.id)} className="btn-secondary text-xs py-1 px-2 text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
