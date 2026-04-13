"use client";

import { useEffect, useState, useMemo } from "react";
import { Send, Plus, Trash2, Edit2, Loader2 } from "lucide-react";
import { formatPHP, formatDate } from "@/lib/utils";

type Transfer = {
  id: number;
  sender: string;
  recipient: string;
  amount: string | number;
  transferDate: string | Date;
  reason: string | null;
  paymentMethod: string | null;
  status: string;
  createdAt: string | Date;
};

type ReceiverPerson = {
  name: string;
  role: "employee" | "host";
};

export default function PaymentTransfersPage() {
  const [recipientOptions, setRecipientOptions] = useState<ReceiverPerson[]>([]);

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    sender: "",
    recipient: "",
    amount: "",
    transferDate: new Date().toISOString().split("T")[0],
    reason: "",
    paymentMethod: "bank transfer",
  });

  // Fetch transfers
  const fetchTransfers = async () => {
    try {
      const [transferRes, settingsRes] = await Promise.all([
        fetch("/api/payment-transfers"),
        fetch("/api/settings"),
      ]);

      const data = await transferRes.json();
      const settings = await settingsRes.json();
      setTransfers(data);

      const receiverPersons = Array.isArray(settings.receiverPersons)
        ? settings.receiverPersons
        : Array.isArray(settings.receivers)
        ? settings.receivers.map((name: string) => ({ name, role: "employee" as const }))
        : [];

      setRecipientOptions(receiverPersons);
      setFormData((prev) => ({
        ...prev,
        sender: prev.sender || "riemar",
      }));
    } catch (error) {
      console.error("Failed to fetch transfers:", error);
      alert("Failed to load transfers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  // Calculate totals
  const totals = useMemo(() => {
    return {
      total: transfers.reduce(
        (sum, t) => sum + parseFloat(t.amount as string),
        0
      ),
      transferred: transfers
        .filter((t) => t.status === "transferred")
        .reduce((sum, t) => sum + parseFloat(t.amount as string), 0),
      pending: transfers
        .filter((t) => t.status === "pending")
        .reduce((sum, t) => sum + parseFloat(t.amount as string), 0),
    };
  }, [transfers]);

  // Group by recipient
  const byRecipient = useMemo(() => {
    const groups: { [key: string]: { count: number; total: number } } = {};
    transfers.forEach((t) => {
      if (!groups[t.recipient]) {
        groups[t.recipient] = { count: 0, total: 0 };
      }
      groups[t.recipient].count++;
      groups[t.recipient].total += parseFloat(t.amount as string);
    });
    return groups;
  }, [transfers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.sender.trim() || !formData.recipient.trim() || !formData.amount) {
      alert("Please fill in sender, recipient, and amount");
      return;
    }
    if (formData.sender.trim().toLowerCase() === formData.recipient.trim().toLowerCase()) {
      alert("Sender and recipient must be different");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = editingId
        ? `/api/payment-transfers/${editingId}`
        : "/api/payment-transfers";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Error: ${error.error}`);
        return;
      }

      // Reset form
      setFormData({
        sender: formData.sender,
        recipient: "",
        amount: "",
        transferDate: new Date().toISOString().split("T")[0],
        reason: "",
        paymentMethod: "bank transfer",
      });
      setEditingId(null);

      // Refresh
      await fetchTransfers();
    } catch (error) {
      console.error("Submit error:", error);
      alert("Failed to save transfer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (transfer: Transfer) => {
    setFormData({
      sender: transfer.sender,
      recipient: transfer.recipient,
      amount: transfer.amount.toString(),
      transferDate: new Date(transfer.transferDate).toISOString().split("T")[0],
      reason: transfer.reason || "",
      paymentMethod: transfer.paymentMethod || "bank transfer",
    });
    setEditingId(transfer.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this transfer?")) return;

    try {
      const res = await fetch(`/api/payment-transfers/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        alert("Failed to delete transfer");
        return;
      }

      await fetchTransfers();
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete transfer");
    }
  };

  const handleCancel = () => {
    setFormData({
      sender: formData.sender || "riemar",
      recipient: "",
      amount: "",
      transferDate: new Date().toISOString().split("T")[0],
      reason: "",
      paymentMethod: "bank transfer",
    });
    setEditingId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-5">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Send className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Payment Transfers
            </h1>
          </div>
          <p className="text-gray-600">
            Track money sent to sir mike, james, or other recipients
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="card p-4 sm:p-5 bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">
              Total Transfers
            </p>
            <p className="text-2xl font-bold text-blue-900 mt-2">
              {formatPHP(totals.total)}
            </p>
            <p className="text-xs text-blue-600 mt-1">{transfers.length} transfers</p>
          </div>

          <div className="card p-4 sm:p-5 bg-green-50 border border-green-200">
            <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">
              Transferred
            </p>
            <p className="text-2xl font-bold text-green-900 mt-2">
              {formatPHP(totals.transferred)}
            </p>
            <p className="text-xs text-green-600 mt-1">
              {transfers.filter((t) => t.status === "transferred").length} complete
            </p>
          </div>

          <div className="card p-4 sm:p-5 bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold">
              Pending
            </p>
            <p className="text-2xl font-bold text-amber-900 mt-2">
              {formatPHP(totals.pending)}
            </p>
            <p className="text-xs text-amber-600 mt-1">
              {transfers.filter((t) => t.status === "pending").length} pending
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-1">
            <div className="card p-5 sticky top-5">
              <div className="flex items-center gap-2 mb-5">
                <Plus className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-900">
                  {editingId ? "Edit Transfer" : "New Transfer"}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sender *
                  </label>
                  <select
                    value={formData.sender}
                    onChange={(e) =>
                      setFormData({ ...formData, sender: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select sender</option>
                    {recipientOptions.map((person) => (
                      <option key={`sender-${person.name}`} value={person.name}>
                        {person.name} ({person.role === "host" ? "Host" : "Employee"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Recipient */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recipient *
                  </label>
                  <select
                    value={formData.recipient}
                    onChange={(e) =>
                      setFormData({ ...formData, recipient: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select owner or employee</option>
                    {recipientOptions
                      .filter((person) => person.name.toLowerCase() !== formData.sender.toLowerCase())
                      .map((person) => (
                      <option key={`recipient-${person.name}`} value={person.name}>
                        {person.name} ({person.role === "host" ? "Host" : "Employee"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount (₱) *
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Transfer Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transfer Date *
                  </label>
                  <input
                    type="date"
                    value={formData.transferDate}
                    onChange={(e) =>
                      setFormData({ ...formData, transferDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) =>
                      setFormData({ ...formData, paymentMethod: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank transfer">Bank Transfer</option>
                    <option value="gcash">GCash</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason / Notes
                  </label>
                  <textarea
                    placeholder="e.g., Salary, Commission, Loan..."
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        {editingId ? "Update" : "Add"}
                      </>
                    )}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-3 rounded-lg transition"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Summary by Recipient */}
          <div className="lg:col-span-2">
            {/* By Recipient */}
            <div className="card p-5 mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">By Recipient</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(byRecipient).map(([recipient, { count, total }]) => (
                  <div
                    key={recipient}
                    className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg"
                  >
                    <p className="font-semibold text-gray-900 capitalize">
                      {recipient}
                    </p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">
                      {formatPHP(total)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">{count} transfers</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Transfers List */}
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-gray-900">All Transfers</h3>
              {loading ? (
                <div className="card p-8 text-center text-gray-600">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              ) : transfers.length === 0 ? (
                <div className="card p-8 text-center text-gray-500">
                  <Send className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No transfers yet</p>
                </div>
              ) : (
                transfers.map((transfer) => (
                  <div
                    key={transfer.id}
                    className={`card p-4 flex items-center justify-between ${
                      transfer.status === "pending"
                        ? "border-l-4 border-l-amber-500 bg-amber-50"
                        : "border-l-4 border-l-green-500 bg-green-50"
                    }`}
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 capitalize">
                        {transfer.sender} to {transfer.recipient}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {transfer.reason || "No reason"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(transfer.transferDate)} • {transfer.paymentMethod}
                      </p>
                    </div>
                    <div className="text-right mr-4">
                      <p className="text-xl font-bold text-gray-900">
                        {formatPHP(parseFloat(transfer.amount as string))}
                      </p>
                      <span
                        className={`text-xs font-semibold mt-1 inline-block px-2 py-1 rounded-full capitalize ${
                          transfer.status === "pending"
                            ? "bg-amber-200 text-amber-800"
                            : "bg-green-200 text-green-800"
                        }`}
                      >
                        {transfer.status}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(transfer)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(transfer.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
