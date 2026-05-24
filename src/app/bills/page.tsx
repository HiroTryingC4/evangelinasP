"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Edit2, CheckCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { formatPHP, formatDate } from "@/lib/utils";

export default function BillsPage() {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");
  const [monthlyValue, setMonthlyValue] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [newBill, setNewBill] = useState({ description: "", amount: "", billDate: "", dueDate: "", category: "", notes: "" });

  const fetchBills = async () => {
    try {
      const url = filter === "all" ? "/api/bills" : `/api/bills?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      setBills(data);
    } catch (e) {
      console.error("Failed to load bills:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBills(); }, [filter]);

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBill.description || !newBill.amount || !newBill.billDate) return;

    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newBill.description,
          amount: parseInt(newBill.amount),
          billDate: newBill.billDate,
          dueDate: newBill.dueDate || null,
          category: newBill.category,
          notes: newBill.notes,
        }),
      });
      if (res.ok) {
        setNewBill({ description: "", amount: "", billDate: "", dueDate: "", category: "", notes: "" });
        fetchBills();
      }
    } catch (e) {
      console.error("Failed to add bill:", e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this bill?")) return;
    try {
      await fetch(`/api/bills/${id}`, { method: "DELETE" });
      fetchBills();
    } catch (e) {
      console.error("Failed to delete bill:", e);
    }
  };

  const handleMarkPaid = async (bill: any) => {
    try {
      await fetch(`/api/bills/${bill.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...bill, status: "paid", paidDate: new Date().toISOString().split("T")[0] }),
      });
      fetchBills();
    } catch (e) {
      console.error("Failed to update bill:", e);
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

  const billsInMonth = bills.filter((b) => inSelectedMonth(b.billDate));
  const filteredBills = billsInMonth.filter((b) => filter === "all" ? true : b.status === filter);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  const totalPending = filteredBills.filter((b) => b.status === "pending").reduce((s: number, b: any) => s + b.amount, 0);
  const totalPaid = filteredBills.filter((b) => b.status === "paid").reduce((s: number, b: any) => s + b.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Bills Tracking</h1>
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
          <p className="text-xs text-gray-500 uppercase">Total Bills (This Month)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatPHP(filteredBills.reduce((s: number, b: any) => s + b.amount, 0))}</p>
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
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add New Bill</h2>
        <form onSubmit={handleAddBill} className="space-y-3">
          <input type="text" placeholder="Description" value={newBill.description} onChange={(e) => setNewBill({ ...newBill, description: e.target.value })} className="input w-full" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Amount (₱)" value={newBill.amount} onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })} className="input" />
            <input type="date" value={newBill.billDate} onChange={(e) => setNewBill({ ...newBill, billDate: e.target.value })} className="input" />
            <input type="date" placeholder="Due Date" value={newBill.dueDate} onChange={(e) => setNewBill({ ...newBill, dueDate: e.target.value })} className="input" />
            <input type="text" placeholder="Category" value={newBill.category} onChange={(e) => setNewBill({ ...newBill, category: e.target.value })} className="input" />
          </div>
          <textarea placeholder="Notes" value={newBill.notes} onChange={(e) => setNewBill({ ...newBill, notes: e.target.value })} className="input w-full" rows={2} />
          <button type="submit" className="btn-primary">Add Bill</button>
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
        {filteredBills.map((bill) => (
          <div key={bill.id} className="card p-3 flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-gray-900">{bill.description}</p>
                <span className={`text-xs px-2 py-0.5 rounded ${bill.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{bill.status}</span>
              </div>
              <p className="text-xs text-gray-500">{bill.category} • {formatDate(bill.billDate)}</p>
              {bill.dueDate && <p className="text-xs text-gray-400">Due: {formatDate(bill.dueDate)}</p>}
              {bill.notes && <p className="text-xs text-gray-600 mt-1">{bill.notes}</p>}
            </div>
            <div className="flex items-center gap-2 ml-4">
              <p className="font-bold text-gray-900 text-lg">{formatPHP(bill.amount)}</p>
              {bill.status === "pending" && (
                <button onClick={() => handleMarkPaid(bill)} className="btn-secondary text-xs py-1 px-2">
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => handleDelete(bill.id)} className="btn-secondary text-xs py-1 px-2 text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
