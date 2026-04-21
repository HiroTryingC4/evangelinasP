"use client";
import { useState, useEffect } from "react";
import { X, AlertTriangle, CheckCircle, Loader2, CalendarDays, Clock } from "lucide-react";
import { emitBookingsChanged } from "@/lib/bookings-sync";
import { UNITS, PAYMENT_METHODS, STAFF, calcPaymentStatus, calcRemaining, formatPHP, toYMD } from "@/lib/utils";
import type { Booking } from "@/lib/schema";

interface Props {
  booking?: Booking | null;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY = {
  guestName: "", contactNo: "", unit: "1558",
  checkIn: "", checkInTime: "2:00 PM",
  checkOut: "", checkOutTime: "12:00 PM",
  hoursStayed: "",
  totalFee: "", dpAmount: "", dpDate: "", dpMethod: "GCash", dpReceivedBy: "SIR JAMES",
  fpAmount: "", fpDate: "", fpMethod: "GCash", fpReceivedBy: "SIR JAMES",
};

export default function BookingForm({ booking, onClose, onSaved }: Props) {
  const [form, setForm]         = useState<Record<string, string>>(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [conflict, setConflict] = useState<any[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [units, setUnits]       = useState<string[]>(UNITS);
  const [receivers, setReceivers] = useState<string[]>(STAFF);
  const [unitBookings, setUnitBookings] = useState<Booking[]>([]);
  const [unitBookingsLoading, setUnitBookingsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.units) && d.units.length > 0) setUnits(d.units);
        if (Array.isArray(d.receivers) && d.receivers.length > 0) setReceivers(d.receivers);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.unit) return;

    const ctrl = new AbortController();
    setUnitBookingsLoading(true);

    fetch(`/api/bookings?unit=${encodeURIComponent(form.unit)}`, {
      signal: ctrl.signal,
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUnitBookings(data);
      })
      .catch(() => {})
      .finally(() => setUnitBookingsLoading(false));

    return () => ctrl.abort();
  }, [form.unit]);

  // Populate form when editing
  useEffect(() => {
    if (!booking) { setForm(EMPTY); return; }
    setForm({
      guestName:    booking.guestName     ?? "",
      contactNo:    booking.contactNo     ?? "",
      unit:         booking.unit          ?? "1558",
      checkIn:      booking.checkInDateKey || (booking.checkIn ? toYMD(booking.checkIn) : ""),
      checkInTime:  booking.checkInTime   ?? "2:00 PM",
      checkOut:     booking.checkOutDateKey || (booking.checkOut ? toYMD(booking.checkOut) : ""),
      checkOutTime: booking.checkOutTime  ?? "12:00 PM",
      hoursStayed:  String(booking.hoursStayed  ?? ""),
      totalFee:     String(booking.totalFee      ?? ""),
      dpAmount:     String(booking.dpAmount      ?? ""),
      dpDate:       booking.dpDate ? toYMD(booking.dpDate) : "",
      dpMethod:     booking.dpMethod      ?? "GCash",
      dpReceivedBy: booking.dpReceivedBy  ?? "SIR JAMES",
      fpAmount:     String(booking.fpAmount ?? ""),
      fpDate:       booking.fpDate ? toYMD(booking.fpDate) : "",
      fpMethod:     booking.fpMethod      ?? "GCash",
      fpReceivedBy: booking.fpReceivedBy  ?? "SIR JAMES",
    });
  }, [booking]);

  const set = (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  // Auto-calculate hours when dates change
  useEffect(() => {
    if (!form.checkIn || !form.checkOut) return;
    const diff = (new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 3_600_000;
    if (diff >= 0) setForm((f) => ({ ...f, hoursStayed: String(Math.round(diff)) }));
  }, [form.checkIn, form.checkOut]);

  // Check conflicts when unit/dates change
  useEffect(() => {
    if (!form.unit || !form.checkIn || !form.checkOut) { setConflict(null); return; }
    const ctrl = new AbortController();
    setChecking(true);
    fetch("/api/conflicts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unit: form.unit,
        checkIn: form.checkIn,
        checkInTime: form.checkInTime,
        checkOut: form.checkOut,
        checkOutTime: form.checkOutTime,
        excludeId: booking?.id,
      }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => { setConflict(d.hasConflict ? d.conflicts : null); })
      .catch(() => {})
      .finally(() => setChecking(false));
    return () => ctrl.abort();
  }, [form.unit, form.checkIn, form.checkInTime, form.checkOut, form.checkOutTime]);

  const dp      = Number(form.dpAmount)  || 0;
  const fp      = Number(form.fpAmount)  || 0;
  const total   = Number(form.totalFee)  || 0;
  const remaining = calcRemaining(dp, fp, total);
  const status    = calcPaymentStatus(dp, fp, total);

  const upcomingUnitBookings = unitBookings
    .filter((b) => {
      const target = toYMD(new Date());
      const checkIn = toYMD(b.checkIn);
      const checkOut = toYMD(b.checkOut);
      return checkIn >= target || checkOut >= target;
    })
    .sort((a, b) => {
      const aIn = new Date(a.checkIn).getTime();
      const bIn = new Date(b.checkIn).getTime();
      if (aIn !== bIn) return aIn - bIn;
      return new Date(a.checkOut).getTime() - new Date(b.checkOut).getTime();
    })
    .slice(0, 6);

  const formatDay = (date: string | Date) =>
    new Date(date).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", weekday: "short" });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.guestName.trim()) e.guestName = "Guest name is required";
    if (!form.checkIn)          e.checkIn   = "Check-in date is required";
    if (!form.checkOut)         e.checkOut  = "Check-out date is required";
    if (!form.totalFee)         e.totalFee  = "Total fee is required";
    if (form.checkIn && form.checkOut && form.checkIn > form.checkOut)
      e.checkOut = "Check-out must be after check-in";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const url    = booking ? `/api/bookings/${booking.id}` : "/api/bookings";
      const method = booking ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `HTTP ${res.status}`);
      }
      emitBookingsChanged();
      onSaved();
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      alert(`Failed to save booking: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">
            {booking ? "Edit Booking" : "New Booking"}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Close">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 space-y-4">

          {/* Guest */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Guest name *</label>
              <input
                className={`input ${errors.guestName ? "border-red-400 focus:ring-red-400" : ""}`}
                value={form.guestName} onChange={set("guestName")} placeholder="Full name"
              />
              {errors.guestName && <p className="text-xs text-red-500 mt-1">{errors.guestName}</p>}
            </div>
            <div>
              <label className="label">Contact no.</label>
              <input className="input" value={form.contactNo} onChange={set("contactNo")} placeholder="09XXXXXXXXX" type="tel" />
            </div>
            <div>
              <label className="label">Unit *</label>
              <select className="input" value={form.unit} onChange={set("unit")}>
                {units.map((u) => <option key={u} value={u}>Unit {u}</option>)}
              </select>
            </div>
          </div>

          {/* Selected unit calendar preview */}
          <div className="border border-gray-100 rounded-xl p-3 sm:p-4 bg-white">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Selected unit calendar</p>
                <h3 className="text-sm font-semibold text-gray-900">Upcoming dates for Unit {form.unit}</h3>
              </div>
              {unitBookingsLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
            </div>

            {upcomingUnitBookings.length === 0 ? (
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-sm text-gray-500">
                No upcoming dates for this unit.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {upcomingUnitBookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900 truncate">
                        <CalendarDays className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="truncate">{formatDay(b.checkIn)} → {formatDay(b.checkOut)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />In {b.checkInTime}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Out {b.checkOutTime}</span>
                        <span className="font-medium text-gray-700">{b.guestName}</span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${b.paymentStatus === "Fully Paid" ? "bg-green-100 text-green-800" : b.paymentStatus === "DP Paid" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
                      {b.paymentStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conflict banner */}
          {checking && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking availability…
            </div>
          )}
          {!checking && conflict && conflict.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">Unit conflict detected!</p>
                {conflict.map((c: any) => (
                  <p key={c.id} className="text-xs text-red-600 mt-0.5">
                    Unit {c.unit} - {c.guestName} ({c.checkInTime} to {c.checkOutTime})
                  </p>
                ))}
              </div>
            </div>
          )}
          {!checking && conflict === null && form.checkIn && form.checkOut && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <CheckCircle className="w-4 h-4" /> Unit is available — no conflicts
            </div>
          )}

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Check-in date *</label>
              <input type="date" className={`input ${errors.checkIn ? "border-red-400" : ""}`} value={form.checkIn} onChange={set("checkIn")} />
              {errors.checkIn && <p className="text-xs text-red-500 mt-1">{errors.checkIn}</p>}
            </div>
            <div>
              <label className="label">Check-in time</label>
              <input className="input" value={form.checkInTime} onChange={set("checkInTime")} placeholder="2:00 PM" />
            </div>
            <div>
              <label className="label">Check-out date *</label>
              <input type="date" className={`input ${errors.checkOut ? "border-red-400" : ""}`} value={form.checkOut} onChange={set("checkOut")} />
              {errors.checkOut && <p className="text-xs text-red-500 mt-1">{errors.checkOut}</p>}
            </div>
            <div>
              <label className="label">Check-out time</label>
              <input className="input" value={form.checkOutTime} onChange={set("checkOutTime")} placeholder="12:00 PM" />
            </div>
            <div>
              <label className="label">Hours stayed</label>
              <input type="number" className="input bg-gray-50 cursor-not-allowed" value={form.hoursStayed} readOnly tabIndex={-1} />
            </div>
            <div>
              <label className="label">Total fee (₱) *</label>
              <input
                type="number" min="0"
                className={`input ${errors.totalFee ? "border-red-400" : ""}`}
                value={form.totalFee} onChange={set("totalFee")} placeholder="0"
              />
              {errors.totalFee && <p className="text-xs text-red-500 mt-1">{errors.totalFee}</p>}
            </div>
          </div>

          {/* Down payment */}
          <div className="border border-gray-100 rounded-xl p-3 sm:p-4 bg-gray-50 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Down Payment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Amount (₱)</label>
                <input type="number" min="0" className="input" value={form.dpAmount} onChange={set("dpAmount")} placeholder="0" />
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={form.dpDate} onChange={set("dpDate")} />
              </div>
              <div>
                <label className="label">Method</label>
                <select className="input" value={form.dpMethod} onChange={set("dpMethod")}>
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Received by</label>
                <select className="input" value={form.dpReceivedBy} onChange={set("dpReceivedBy")}>
                  {receivers.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Full payment */}
          <div className="border border-gray-100 rounded-xl p-3 sm:p-4 bg-gray-50 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Payment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Amount (₱)</label>
                <input type="number" min="0" className="input" value={form.fpAmount} onChange={set("fpAmount")} placeholder="0" />
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={form.fpDate} onChange={set("fpDate")} />
              </div>
              <div>
                <label className="label">Method</label>
                <select className="input" value={form.fpMethod} onChange={set("fpMethod")}>
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Received by</label>
                <select className="input" value={form.fpReceivedBy} onChange={set("fpReceivedBy")}>
                  {receivers.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Live payment summary */}
          {total > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Remaining balance</p>
                <p className="text-2xl font-bold text-gray-900">{formatPHP(remaining)}</p>
              </div>
              <span className={`text-sm px-4 py-1.5 rounded-full font-semibold ${
                status === "Fully Paid" ? "bg-green-100 text-green-800" :
                status === "DP Paid"   ? "bg-yellow-100 text-yellow-800" :
                                          "bg-red-100 text-red-800"
              }`}>{status}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-white rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary" disabled={saving}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary min-w-[120px] justify-center">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : booking ? "Update Booking" : "Add Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
