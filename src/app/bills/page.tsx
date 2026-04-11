"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Edit2, CheckCircle, Clock } from "lucide-react";
import { formatPHP, formatDate } from "@/lib/utils";

export default function BillsPage() {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  const totalPending = bills.filter((b) => b.status === "pending").reduce((s: number, b: any) => s + b.amount, 0);
  const totalPaid = bills.filter((b) => b.status === "paid").reduce((s: number, b: any) => s + b.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Bills Tracking</h1>
        <Link href="/" className="text-xs text-blue-600 hover:underline">← Back to Dashboard</Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Total Bills</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatPHP(bills.reduce((s: number, b: any) => s + b.amount, 0))}</p>
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
        {bills.map((bill) => (
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
