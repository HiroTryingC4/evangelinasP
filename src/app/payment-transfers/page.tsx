"use client";

import { useEffect, useState, useMemo } from "react";
import { Send, Plus, Trash2, Edit2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { formatPHP, formatDate, formatWeekRange, getSundayToSaturdayWeek } from "@/lib/utils";

type Transfer = {
  id: number;
  sender: string;
  recipient: string;
  amount: string | number;
  transferDate: string | Date;
  sourceUnit?: string | null;
  sourceWeekStart?: string | Date | null;
  reason: string | null;
  paymentMethod: string | null;
  status: string;
  createdAt: string | Date;
};

type ReceiverPerson = {
  name: string;
  role: "employee" | "host";
};

type ReceiverAccount = {
  name: string;
  role: "employee" | "host";
  bookingReceived: number;
  incomingTransfers: number;
  outgoingTransfers: number;
  availableBalance: number;
};

export default function PaymentTransfersPage() {
  const [recipientOptions, setRecipientOptions] = useState<ReceiverPerson[]>([]);
  const [receiverAccounts, setReceiverAccounts] = useState<ReceiverAccount[]>([]);
  const [units, setUnits] = useState<string[]>([]);

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [scopeFilter, setScopeFilter] = useState<"week" | "month" | "all">("all");
  const [weeklyDate, setWeeklyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [monthlyDate, setMonthlyDate] = useState(() => new Date().toISOString().slice(0, 7));
  const [accountScope, setAccountScope] = useState<"all" | "month">("all");
  const [accountMonth, setAccountMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const shiftWeek = (days: number) => {
    const base = new Date(`${weeklyDate}T12:00:00`);
    if (Number.isNaN(base.getTime())) return;
    base.setDate(base.getDate() + days);
    setWeeklyDate(base.toISOString().slice(0, 10));
  };

  const shiftMonth = (months: number) => {
    const base = new Date(`${monthlyDate}-01T12:00:00`);
    if (Number.isNaN(base.getTime())) return;
    base.setMonth(base.getMonth() + months);
    setMonthlyDate(base.toISOString().slice(0, 7));
  };

  // Form state
  const [formData, setFormData] = useState({
    sender: "",
    recipient: "",
    amount: "",
    transferDate: new Date().toISOString().split("T")[0],
    sourceUnit: "",
    sourceWeekStart: new Date().toISOString().split("T")[0],
    reason: "",
    paymentMethod: "bank transfer",
  });

  const formatWeekLabel = (value: string) => {
    const base = new Date(`${value}T12:00:00`);
    if (Number.isNaN(base.getTime())) return "";
    const start = new Date(base);
    start.setDate(base.getDate() - base.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${start.toLocaleDateString(undefined, opts)} - ${end.toLocaleDateString(undefined, opts)}`;
  };

  const setWeekByOffset = (offsetDays: number) => {
    const base = new Date(`${formData.sourceWeekStart}T12:00:00`);
    if (Number.isNaN(base.getTime())) return;
    base.setDate(base.getDate() + offsetDays);
    setFormData((prev) => ({ ...prev, sourceWeekStart: base.toISOString().split("T")[0] }));
  };

  // Fetch transfers
  const fetchTransfers = async () => {
    try {
      const [transferRes, settingsRes] = await Promise.all([
        fetch(`/api/payment-transfers?weeklyDate=${weeklyDate}&monthlyDate=${monthlyDate}&scope=${scopeFilter}&includeAccounts=1&accountScope=${accountScope}&accountMonth=${accountMonth}&_ts=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/settings?_ts=${Date.now()}`, { cache: "no-store" }),
      ]);

      const transferPayload = await transferRes.json();
      const settings = await settingsRes.json();

      const list = Array.isArray(transferPayload)
        ? transferPayload
        : (Array.isArray(transferPayload?.transfers) ? transferPayload.transfers : []);
      const accounts = !Array.isArray(transferPayload) && Array.isArray(transferPayload?.accounts)
        ? transferPayload.accounts
        : [];

      setTransfers(list);
      setReceiverAccounts(accounts);

      const receiverPersons = Array.isArray(settings.receiverPersons)
        ? settings.receiverPersons
        : Array.isArray(settings.receivers)
        ? settings.receivers.map((name: string) => ({ name, role: "employee" as const }))
        : [];

      setRecipientOptions(receiverPersons);
      if (Array.isArray(settings.units) && settings.units.length > 0) {
        setUnits(settings.units.map((u: string) => String(u).replace(/^Unit\s*/i, "")));
      }
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
  }, [weeklyDate, monthlyDate, scopeFilter, accountScope, accountMonth]);

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

  const senderAccount = useMemo(() => {
    const senderKey = formData.sender.trim().toLowerCase();
    if (!senderKey) return null;
    return receiverAccounts.find((account) => account.name.trim().toLowerCase() === senderKey) ?? null;
  }, [formData.sender, receiverAccounts]);

  const amountNumber = Number(formData.amount || 0);
  const hasInsufficientFunds = Boolean(
    senderAccount && amountNumber > 0 && amountNumber > Number(senderAccount.availableBalance || 0)
  );

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
    if (hasInsufficientFunds && senderAccount) {
      alert(`Insufficient balance. ${senderAccount.name} only has ${formatPHP(Number(senderAccount.availableBalance))}.`);
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
        sourceUnit: formData.sourceUnit,
        sourceWeekStart: formData.sourceWeekStart,
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
      sourceUnit: transfer.sourceUnit ? String(transfer.sourceUnit) : "",
      sourceWeekStart: transfer.sourceWeekStart
        ? new Date(transfer.sourceWeekStart).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
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
      sourceUnit: formData.sourceUnit,
      sourceWeekStart: formData.sourceWeekStart,
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
        <div className="card p-4 sm:p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Transfer Scope</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {scopeFilter === "all"
                  ? "All transfer records"
                  : scopeFilter === "month"
                    ? new Date(`${monthlyDate}-01T12:00:00`).toLocaleDateString("en-PH", { month: "long", year: "numeric" })
                    : formatWeekRange(getSundayToSaturdayWeek(weeklyDate).startDate, getSundayToSaturdayWeek(weeklyDate).endDate)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => shiftWeek(-7)}
                className="btn-secondary text-xs py-1.5"
                disabled={scopeFilter !== "week"}
              >
                <ChevronLeft className="w-4 h-4" /> Prev Week
              </button>
              <input
                type="date"
                className="input py-1.5 text-xs w-auto"
                value={weeklyDate}
                onChange={(e) => setWeeklyDate(e.target.value)}
                disabled={scopeFilter !== "week"}
              />
              <button
                type="button"
                onClick={() => shiftWeek(7)}
                className="btn-secondary text-xs py-1.5"
                disabled={scopeFilter !== "week"}
              >
                Next Week <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="btn-secondary text-xs py-1.5"
                disabled={scopeFilter !== "month"}
              >
                <ChevronLeft className="w-4 h-4" /> Prev Month
              </button>
              <input
                type="month"
                className="input py-1.5 text-xs w-auto"
                value={monthlyDate}
                onChange={(e) => setMonthlyDate(e.target.value)}
                disabled={scopeFilter !== "month"}
              />
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="btn-secondary text-xs py-1.5"
                disabled={scopeFilter !== "month"}
              >
                Next Month <ChevronRight className="w-4 h-4" />
              </button>
              <select
                className="input py-1.5 text-xs"
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value as "week" | "month" | "all")}
              >
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="all">All transfers</option>
              </select>
            </div>
          </div>
        </div>

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
                  {senderAccount && (
                    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                      <p className="text-xs text-blue-700">Available balance</p>
                      <p className="text-sm font-semibold text-blue-900">{formatPHP(Number(senderAccount.availableBalance))}</p>
                    </div>
                  )}
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
                  {hasInsufficientFunds && senderAccount && (
                    <p className="text-xs text-red-600 mt-1">
                      Not enough balance. Available: {formatPHP(Number(senderAccount.availableBalance))}
                    </p>
                  )}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source Unit (where deducted)
                  </label>
                  <select
                    value={formData.sourceUnit}
                    onChange={(e) =>
                      setFormData({ ...formData, sourceUnit: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No specific unit</option>
                    {units.map((unit) => (
                      <option key={unit} value={unit}>Unit {unit}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source Week (where deducted)
                  </label>
                  <input
                    type="date"
                    value={formData.sourceWeekStart}
                    onChange={(e) =>
                      setFormData({ ...formData, sourceWeekStart: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Week: {formatWeekLabel(formData.sourceWeekStart)}</p>
                  <div className="flex gap-2 mt-2">
                    <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => setWeekByOffset(-7)}>Prev Week</button>
                    <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => setFormData({ ...formData, sourceWeekStart: new Date().toISOString().split("T")[0] })}>This Week</button>
                    <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => setWeekByOffset(7)}>Next Week</button>
                  </div>
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
                    disabled={submitting || hasInsufficientFunds}
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

            <div className="card p-5 mb-6">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <h3 className="text-lg font-bold text-gray-900">Receiver Account Balances</h3>
                <div className="flex items-center gap-2">
                  <select
                    className="input py-1.5 text-xs"
                    value={accountScope}
                    onChange={(e) => setAccountScope(e.target.value as "all" | "month")}
                  >
                    <option value="month">By month</option>
                    <option value="all">All time</option>
                  </select>
                  <input
                    type="month"
                    className="input py-1.5 text-xs"
                    value={accountMonth}
                    onChange={(e) => setAccountMonth(e.target.value)}
                    disabled={accountScope !== "month"}
                  />
                </div>
              </div>
              {receiverAccounts.length === 0 ? (
                <p className="text-sm text-gray-500">No receiver balances yet.</p>
              ) : (
                <div className="space-y-2">
                  {receiverAccounts.map((account) => (
                    <div key={account.name} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900">
                          {account.name} ({account.role === "host" ? "Host" : "Employee"})
                        </p>
                        <p className={`text-sm font-bold ${Number(account.availableBalance) < 0 ? "text-red-600" : "text-green-700"}`}>
                          {formatPHP(Number(account.availableBalance))}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        From bookings: {formatPHP(Number(account.bookingReceived))} | In transfers: {formatPHP(Number(account.incomingTransfers))} | Out transfers: {formatPHP(Number(account.outgoingTransfers))}
                      </p>
                    </div>
                  ))}
                </div>
              )}
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
