"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";

type SettingsResponse = {
  units: string[];
  receivers: string[];
  receiverPersons?: { name: string; role: "employee" | "host" }[];
};

type ReceiverPerson = { name: string; role: "employee" | "host" };

export default function SettingsPage() {
  const [units, setUnits] = useState<string[]>([]);
  const [receivers, setReceivers] = useState<ReceiverPerson[]>([]);
  const [newUnit, setNewUnit] = useState("");
  const [newReceiver, setNewReceiver] = useState("");
  const [newReceiverRole, setNewReceiverRole] = useState<"employee" | "host">("employee");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/settings?_ts=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: SettingsResponse) => {
        setUnits(data.units ?? []);
        if (Array.isArray(data.receiverPersons) && data.receiverPersons.length > 0) {
          setReceivers(data.receiverPersons);
        } else {
          setReceivers((data.receivers ?? []).map((name) => ({ name, role: "employee" })));
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load settings.");
        setLoading(false);
      });
  }, []);

  const addUnit = () => {
    const code = newUnit.trim().replace(/^Unit\s*/i, "");
    if (!code) return;
    if (units.includes(code)) return;
    setUnits((prev) => [...prev, code]);
    setNewUnit("");
    setMessage("");
  };

  const addReceiver = () => {
    const name = newReceiver.trim();
    if (!name) return;
    if (receivers.some((r) => r.name.toLowerCase() === name.toLowerCase())) return;
    setReceivers((prev) => [...prev, { name, role: newReceiverRole }]);
    setNewReceiver("");
    setNewReceiverRole("employee");
    setMessage("");
  };

  const updateReceiverRole = (idx: number, role: "employee" | "host") => {
    setReceivers((prev) => prev.map((item, i) => (i === idx ? { ...item, role } : item)));
    setMessage("");
  };

  const removeAt = (type: "unit" | "receiver", idx: number) => {
    if (type === "unit") setUnits((prev) => prev.filter((_, i) => i !== idx));
    else setReceivers((prev) => prev.filter((_, i) => i !== idx));
    setMessage("");
  };

  const save = async () => {
    setError("");
    setMessage("");

    if (units.length === 0) {
      setError("Add at least one unit.");
      return;
    }
    if (receivers.length === 0) {
      setError("Add at least one receiver person.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ units, receivers }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save");

      setUnits(data.units ?? units);
      if (Array.isArray(data.receiverPersons) && data.receiverPersons.length > 0) {
        setReceivers(data.receiverPersons);
      } else {
        setReceivers(receivers);
      }
      setMessage("Saved. New units/receivers are now available in forms and filters.");
    } catch (e: any) {
      setError(e?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Manage units and receiver persons</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary">
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {error && <div className="card p-3 text-sm text-red-600">{error}</div>}
      {message && <div className="card p-3 text-sm text-green-700">{message}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Unit Numbers</h2>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="e.g. 1666"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
            />
            <button type="button" className="btn-secondary" onClick={addUnit}>
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {units.map((u, i) => (
              <div key={`${u}-${i}`} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-gray-50">
                <span className="text-sm font-medium text-gray-800">Unit {u}</span>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => removeAt("unit", i)}
                  disabled={units.length <= 1}
                  title={units.length <= 1 ? "At least one unit is required" : "Remove unit"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Receiver Persons</h2>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="e.g. SIR JOHN"
              value={newReceiver}
              onChange={(e) => setNewReceiver(e.target.value)}
            />
            <select
              className="input max-w-[140px]"
              value={newReceiverRole}
              onChange={(e) => setNewReceiverRole((e.target.value === "host" ? "host" : "employee"))}
            >
              <option value="employee">Employee</option>
              <option value="host">Host</option>
            </select>
            <button type="button" className="btn-secondary" onClick={addReceiver}>
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {receivers.map((item, i) => (
              <div key={`${item.name}-${i}`} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-gray-50 gap-2">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-gray-800">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="input h-9 py-1 max-w-[120px]"
                    value={item.role}
                    onChange={(e) => updateReceiverRole(i, e.target.value === "host" ? "host" : "employee")}
                  >
                    <option value="employee">Employee</option>
                    <option value="host">Host</option>
                  </select>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => removeAt("receiver", i)}
                    disabled={receivers.length <= 1}
                    title={receivers.length <= 1 ? "At least one receiver is required" : "Remove receiver"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
