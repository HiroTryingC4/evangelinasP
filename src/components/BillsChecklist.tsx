"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle } from "lucide-react";

const BILL_TYPES = [
  { id: "condo", name: "Condo Dues", schedule: "1st week of month" },
  { id: "amort", name: "Amortization", schedule: "per 15 days" },
  { id: "electric", name: "Electricity Bill", schedule: "per 15 days" },
  { id: "water", name: "Water Bill", schedule: "per 21 days" },
  { id: "netflix", name: "Netflix", schedule: "per 15 days" },
];

const UNITS = ["1116", "1118", "1558", "1845", "2245"];

interface ChecklistState {
  [key: string]: boolean; // Key: "condo-1116", "amort-1116", etc.
}

export default function BillsChecklist() {
  const [checklist, setChecklist] = useState<ChecklistState>({});
  const [mounted, setMounted] = useState(false);

  // Load checklist from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("billsChecklist");
    if (saved) {
      try {
        setChecklist(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse checklist:", e);
      }
    }
    setMounted(true);
  }, []);

  // Save checklist to localStorage whenever it changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("billsChecklist", JSON.stringify(checklist));
    }
  }, [checklist, mounted]);

  const toggleCheck = (billId: string, unitId: string) => {
    const key = `${billId}-${unitId}`;
    setChecklist((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getPaidCount = (billId: string) => {
    return UNITS.filter((unit) => checklist[`${billId}-${unit}`]).length;
  };

  if (!mounted) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-gray-900">Bills Checklist</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left font-semibold text-gray-900 px-2 py-2">Unit</th>
              {BILL_TYPES.map((bill) => (
                <th key={bill.id} className="text-center font-semibold text-gray-900 px-2 py-2 whitespace-nowrap">
                  <div className="text-xs">{bill.name}</div>
                  <div className="text-xs text-gray-500 font-normal">{bill.schedule}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {UNITS.map((unit) => (
              <tr key={unit} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="font-semibold text-gray-900 px-2 py-2">Unit {unit}</td>
                {BILL_TYPES.map((bill) => {
                  const key = `${bill.id}-${unit}`;
                  const isPaid = checklist[key] || false;

                  return (
                    <td key={key} className="text-center px-2 py-2">
                      <button
                        onClick={() => toggleCheck(bill.id, unit)}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded border-2 transition-colors ${
                          isPaid
                            ? "bg-green-100 border-green-400 text-green-700"
                            : "bg-gray-50 border-gray-300 text-gray-400 hover:border-blue-400"
                        }`}
                      >
                        {isPaid ? "✓" : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => setChecklist({})}
        className="mt-3 text-xs text-gray-500 hover:text-gray-700 underline"
      >
        Reset all
      </button>
    </div>
  );
}
