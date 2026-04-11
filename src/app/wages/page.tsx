"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, CheckCircle } from "lucide-react";
import { formatPHP, formatDate } from "@/lib/utils";

export default function WagesPage() {
  const [wages, setWages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");
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

  useEffect(() => { fetchWages(); }, [filter]);

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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  const totalPending = wages.filter((w) => w.status === "pending").reduce((s: number, w: any) => s + w.amount, 0);
  const totalPaid = wages.filter((w) => w.status === "paid").reduce((s: number, w: any) => s + w.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Wages Tracking</h1>
        <Link href="/" className="text-xs text-blue-600 hover:underline">← Back to Dashboard</Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Total Wages</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatPHP(wages.reduce((s: number, w: any) => s + w.amount, 0))}</p>
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

      <div className="space-y-2">
        {wages.map((wage) => (
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
