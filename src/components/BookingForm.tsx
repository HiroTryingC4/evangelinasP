"use client";
import { useState, useEffect } from "react";
import { X, AlertTriangle, CheckCircle, Loader2, CalendarDays, Clock } from "lucide-react";
import { emitBookingsChanged } from "@/lib/bookings-sync";
import { UNITS, PAYMENT_METHODS, STAFF, BOOKING_SOURCES, BOOKING_PLATFORMS, calcPaymentStatus, calcRemaining, formatPHP, getSundayToSaturdayWeek, toYMD } from "@/lib/utils";
import type { Booking } from "@/lib/schema";

interface Props {
  booking?: Booking | null;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY = {
  guestName: "", contactNo: "", unit: "1558", bookingSource: "RIEMAR", bookingPlatform: "Direct",
  checkIn: "", checkInTime: "2:00 PM",
  checkOut: "", checkOutTime: "12:00 PM",
  hoursStayed: "",
  totalFee: "", dpAmount: "", dpDate: "", dpMethod: "GCash", dpReceivedBy: "SIR JAMES",
  fpAmount: "", fpDate: "", fpMethod: "GCash", fpReceivedBy: "SIR JAMES",
  apAmount: "", apDate: "", apMethod: "GCash", apReceivedBy: "SIR JAMES",
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
  const [nightCleaning, setNightCleaning] = useState(false);
  const [nightCleaningTouched, setNightCleaningTouched] = useState(false);
  const [existingNightCleaningExpense, setExistingNightCleaningExpense] = useState<{
    id: number;
    weekStart: string;
    weekEnd: string;
    expenseDate: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/settings?_t=${Date.now()}`, { cache: "no-store" })
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
    if (!booking) {
      setForm(EMPTY);
      setNightCleaning(false);
      return;
    }
    setForm({
      guestName:    booking.guestName     ?? "",
      contactNo:    booking.contactNo     ?? "",
      unit:         booking.unit          ?? "1558",
      bookingSource: booking.bookingSource ?? "RIEMAR",
      bookingPlatform: booking.bookingPlatform ?? "Direct",
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
      apAmount:     String((booking as any).apAmount ?? ""),
      apDate:       (booking as any).apDate ? toYMD((booking as any).apDate) : "",
      apMethod:     (booking as any).apMethod      ?? "GCash",
      apReceivedBy: (booking as any).apReceivedBy  ?? "SIR JAMES",
    });
    setNightCleaning(false);
    setNightCleaningTouched(false);
    setExistingNightCleaningExpense(null);
  }, [booking]);

  async function loadExistingNightCleaningExpense(weekStart: string, weekEnd: string, expectedExpenseDate?: string) {
    try {
      const response = await fetch(
        `/api/manual-expenses/week?weekStart=${encodeURIComponent(weekStart)}&weekEnd=${encodeURIComponent(weekEnd)}`,
        { cache: "no-store" }
      );
      if (!response.ok) return null;
      const expenses = await response.json();
      if (!Array.isArray(expenses)) return null;

      const exactMatch = expenses.find((entry: any) =>
        String(entry.receiver).toUpperCase() === "JAYJAY" &&
        String(entry.comment).toLowerCase().includes("night booking") &&
        Number(entry.amount) === 300 &&
        String(entry.type).toLowerCase() === "expense" &&
        expectedExpenseDate && String(entry.expenseDate) === expectedExpenseDate
      );
      if (exactMatch) return exactMatch;

      return expenses.find((entry: any) =>
        String(entry.receiver).toUpperCase() === "JAYJAY" &&
        String(entry.comment).toLowerCase().includes("night booking") &&
        Number(entry.amount) === 300 &&
        String(entry.type).toLowerCase() === "expense"
      ) ?? null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!booking) return;
    const checkIn = booking.checkInDateKey || (booking.checkIn ? toYMD(booking.checkIn) : "");
    const checkOut = booking.checkOutDateKey || (booking.checkOut ? toYMD(booking.checkOut) : "");
    const dateSource = checkIn || checkOut;
    if (!dateSource) return;

    const week = getSundayToSaturdayWeek(dateSource);
    loadExistingNightCleaningExpense(week.startDate, week.endDate, checkIn || undefined).then((existing) => {
      if (existing) {
        setExistingNightCleaningExpense({
          id: existing.id,
          weekStart: existing.weekStart,
          weekEnd: existing.weekEnd,
          expenseDate: existing.expenseDate,
        });
        setNightCleaning(true);
      } else {
        setExistingNightCleaningExpense(null);
        setNightCleaning(false);
      }
    });
  }, [booking]);

  const set = (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  function parseClockTime(value: string): number | null {
    const normalized = String(value || "").trim().toLowerCase();
    const ampmMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    if (ampmMatch) {
      let hour = Number(ampmMatch[1]);
      const minute = Number(ampmMatch[2] || "0");
      const ampm = ampmMatch[3];
      if (hour === 12) hour = ampm === "am" ? 0 : 12;
      else if (ampm === "pm") hour += 12;
      return hour * 60 + minute;
    }

    const twentyFourMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (twentyFourMatch) {
      const hour = Number(twentyFourMatch[1]);
      const minute = Number(twentyFourMatch[2] || "0");
      if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
        return hour * 60 + minute;
      }
    }

    return null;
  }

  function bookingLooksLikeNightShift(checkInTime: string, checkOutTime: string) {
    const checkIn = parseClockTime(checkInTime);
    const checkOut = parseClockTime(checkOutTime);
    const isNight = (minutes: number | null) => minutes !== null && (minutes >= 20 * 60 || minutes < 6 * 60);
    return isNight(checkIn) || isNight(checkOut);
  }

  useEffect(() => {
    if (booking) return;
    if (nightCleaningTouched) return;
    const isNight = bookingLooksLikeNightShift(form.checkInTime, form.checkOutTime);
    setNightCleaning(isNight);
  }, [form.checkInTime, form.checkOutTime, booking, nightCleaningTouched]);

  // Auto-calculate hours when dates change
  useEffect(() => {
    if (!form.checkIn || !form.checkOut) return;
    const diff = (new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 3_600_000;
    if (diff >= 0) setForm((f) => ({ ...f, hoursStayed: String(Math.round(diff)) }));
  }, [form.checkIn, form.checkOut]);

  // Auto-set booking source to RIEMAR when platform is TikTok
  useEffect(() => {
    if (form.bookingPlatform === "TikTok") {
      setForm((f) => ({ ...f, bookingSource: "RIEMAR" }));
    }
  }, [form.bookingPlatform]);

  // Auto-set booking source to SIR JAMES when platform is Airbnb
  useEffect(() => {
    if (form.bookingPlatform === "Airbnb") {
      setForm((f) => ({ ...f, bookingSource: "SIR JAMES" }));
    }
  }, [form.bookingPlatform]);

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
  const ap      = Number(form.apAmount)  || 0;
  const total   = Number(form.totalFee)  || 0;
  const remaining = calcRemaining(dp, fp, total, ap);
  const status    = calcPaymentStatus(dp, fp, total, ap);

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

      const week = getSundayToSaturdayWeek(form.checkIn || form.checkOut || new Date());
      const expenseDate = form.checkIn || week.startDate;
      const existingExpenseId = existingNightCleaningExpense?.id;

      if (nightCleaning && !existingExpenseId) {
        try {
          const response = await fetch("/api/manual-expenses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              weekStart: week.startDate,
              weekEnd: week.endDate,
              receiver: "JAYJAY",
              amount: 300,
              comment: "Night Booking",
              type: "expense",
              expenseDate,
            }),
          });
          if (response.ok) {
            const created = await response.json();
            setExistingNightCleaningExpense({
              id: created.id,
              weekStart: week.startDate,
              weekEnd: week.endDate,
              expenseDate,
            });
          }
        } catch (error) {
          console.error("Failed to create Jayjay night booking expense:", error);
        }
      }

      if (nightCleaning && existingExpenseId) {
        const shouldRecreate =
          existingNightCleaningExpense?.weekStart !== week.startDate ||
          existingNightCleaningExpense?.weekEnd !== week.endDate;
        const shouldUpdateDate = existingNightCleaningExpense?.expenseDate !== expenseDate;

        if (shouldRecreate) {
          try {
            await fetch(`/api/manual-expenses?id=${existingExpenseId}`, {
              method: "DELETE",
            });
          } catch (error) {
            console.error("Failed to delete stale Jayjay night booking expense:", error);
          }
          try {
            const response = await fetch("/api/manual-expenses", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                weekStart: week.startDate,
                weekEnd: week.endDate,
                receiver: "JAYJAY",
                amount: 300,
                comment: "Night Booking",
                type: "expense",
                expenseDate,
              }),
            });
            if (response.ok) {
              const created = await response.json();
              setExistingNightCleaningExpense({
                id: created.id,
                weekStart: week.startDate,
                weekEnd: week.endDate,
                expenseDate,
              });
            }
          } catch (error) {
            console.error("Failed to recreate Jayjay night booking expense:", error);
          }
        } else if (shouldUpdateDate) {
          try {
            await fetch(`/api/manual-expenses?id=${existingExpenseId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                amount: 300,
                comment: "Night Booking",
                type: "expense",
                expenseDate,
              }),
            });
            setExistingNightCleaningExpense((prev) => prev ? { ...prev, expenseDate } : prev);
          } catch (error) {
            console.error("Failed to update Jayjay night booking expense date:", error);
          }
        }
      }

      if (!nightCleaning && existingExpenseId) {
        try {
          await fetch(`/api/manual-expenses?id=${existingExpenseId}`, {
            method: "DELETE",
          });
          setExistingNightCleaningExpense(null);
        } catch (error) {
          console.error("Failed to remove Jayjay night booking expense:", error);
        }
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 flex-shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              {booking ? "Edit Booking" : "New Booking"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {booking ? "Update booking details" : "Create a new booking"}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/80 rounded-lg transition-all duration-200 hover:scale-110" 
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 space-y-4">

          {/* Guest */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label flex items-center gap-1">
                <span>Guest name</span>
                <span className="text-red-500">*</span>
              </label>
              <input
                className={`input transition-all duration-200 ${errors.guestName ? "border-red-400 focus:ring-red-400 shake" : "focus:border-blue-400 focus:ring-blue-400"}`}
                value={form.guestName} onChange={set("guestName")} placeholder="Full name"
              />
              {errors.guestName && <p className="text-xs text-red-500 mt-1 animate-in slide-in-from-top-1">{errors.guestName}</p>}
            </div>
            <div>
              <label className="label">Contact no.</label>
              <input className="input focus:border-blue-400 focus:ring-blue-400 transition-all duration-200" value={form.contactNo} onChange={set("contactNo")} placeholder="09XXXXXXXXX" type="tel" />
            </div>
            <div>
              <label className="label flex items-center gap-1">
                <span>Unit</span>
                <span className="text-red-500">*</span>
              </label>
              <select className="input focus:border-blue-400 focus:ring-blue-400 transition-all duration-200" value={form.unit} onChange={set("unit")}>
                {units.map((u) => <option key={u} value={u}>Unit {u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Booked by (who got this booking)</label>
              <select className="input focus:border-blue-400 focus:ring-blue-400 transition-all duration-200" value={form.bookingSource} onChange={set("bookingSource")}>
                {BOOKING_SOURCES.map((source) => <option key={source} value={source}>{source}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Platform (where it came from)</label>
              <select className="input focus:border-blue-400 focus:ring-blue-400 transition-all duration-200" value={form.bookingPlatform} onChange={set("bookingPlatform")}>
                {BOOKING_PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
              </select>
            </div>
          </div>

          {/* Selected unit calendar preview */}
          <div className="border border-blue-100 rounded-xl p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Selected unit calendar</p>
                <h3 className="text-sm font-semibold text-gray-900">Upcoming dates for Unit {form.unit}</h3>
              </div>
              {unitBookingsLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
            </div>

            {upcomingUnitBookings.length === 0 ? (
              <div className="rounded-lg bg-white/60 border border-blue-100 p-3 text-sm text-gray-500 text-center">
                No upcoming dates for this unit.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {upcomingUnitBookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white/80 backdrop-blur-sm px-3 py-2 hover:shadow-md transition-all duration-200">
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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${b.paymentStatus === "Fully Paid" ? "bg-green-100 text-green-800" : b.paymentStatus === "DP Paid" ? "bg-yellow-100 text-yellow-800" : b.paymentStatus === "Canceled" ? "bg-gray-200 text-gray-700" : "bg-red-100 text-red-800"}`}>
                      {b.paymentStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conflict banner */}
          {checking && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking availability…
            </div>
          )}
          {!checking && conflict && conflict.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg animate-in slide-in-from-top-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0 animate-bounce" />
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
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 animate-in slide-in-from-top-2">
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
          <div className="border border-green-100 rounded-xl p-3 sm:p-4 bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm space-y-3">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Down Payment
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Amount (₱)</label>
                <input type="number" min="0" className="input focus:border-green-400 focus:ring-green-400 transition-all duration-200" value={form.dpAmount} onChange={set("dpAmount")} placeholder="0" />
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input focus:border-green-400 focus:ring-green-400 transition-all duration-200" value={form.dpDate} onChange={set("dpDate")} />
              </div>
              <div>
                <label className="label">Method</label>
                <select className="input focus:border-green-400 focus:ring-green-400 transition-all duration-200" value={form.dpMethod} onChange={set("dpMethod")}>
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Received by</label>
                <select className="input focus:border-green-400 focus:ring-green-400 transition-all duration-200" value={form.dpReceivedBy} onChange={set("dpReceivedBy")}>
                  {receivers.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Full payment */}
          <div className="border border-blue-100 rounded-xl p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm space-y-3">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Full Payment
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Amount (₱)</label>
                <input type="number" min="0" className="input focus:border-blue-400 focus:ring-blue-400 transition-all duration-200" value={form.fpAmount} onChange={set("fpAmount")} placeholder="0" />
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input focus:border-blue-400 focus:ring-blue-400 transition-all duration-200" value={form.fpDate} onChange={set("fpDate")} />
              </div>
              <div>
                <label className="label">Method</label>
                <select className="input focus:border-blue-400 focus:ring-blue-400 transition-all duration-200" value={form.fpMethod} onChange={set("fpMethod")}>
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Received by</label>
                <select className="input focus:border-blue-400 focus:ring-blue-400 transition-all duration-200" value={form.fpReceivedBy} onChange={set("fpReceivedBy")}>
                  {receivers.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Additional payment */}
          <div className="border border-purple-100 rounded-xl p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-pink-50 shadow-sm space-y-3">
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              Additional Payment
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Amount (₱)</label>
                <input type="number" min="0" className="input focus:border-purple-400 focus:ring-purple-400 transition-all duration-200" value={form.apAmount} onChange={set("apAmount")} placeholder="0" />
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input focus:border-purple-400 focus:ring-purple-400 transition-all duration-200" value={form.apDate} onChange={set("apDate")} />
              </div>
              <div>
                <label className="label">Method</label>
                <select className="input focus:border-purple-400 focus:ring-purple-400 transition-all duration-200" value={form.apMethod} onChange={set("apMethod")}>
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Received by</label>
                <select className="input focus:border-purple-400 focus:ring-purple-400 transition-all duration-200" value={form.apReceivedBy} onChange={set("apReceivedBy")}>
                  {receivers.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Live payment summary */}
          {total > 0 && (
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4 flex items-center justify-between shadow-lg">
              <div>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-0.5">Remaining balance</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{formatPHP(remaining)}</p>
              </div>
              <span className={`text-sm px-4 py-2 rounded-full font-semibold shadow-md ${
                status === "Fully Paid" ? "bg-green-500 text-white" :
                status === "DP Paid"   ? "bg-yellow-500 text-white" :
                status === "Canceled"  ? "bg-gray-400 text-white" :
                                          "bg-red-500 text-white"
              }`}>{status}</span>
            </div>
          )}

          <label className="flex items-center gap-3 rounded-xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
            <input
              type="checkbox"
              checked={nightCleaning}
              onChange={(e) => {
                setNightCleaningTouched(true);
                setNightCleaning(e.target.checked);
              }}
              className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <p className="text-sm font-semibold text-gray-900">Night Cleaning</p>
              <p className="text-xs text-gray-500">Adds a ₱300 Clean Night expense to Finances after saving.</p>
              <p className="text-xs text-gray-500">This expense is linked to this booking’s week/date and will update or remove on save.</p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-gradient-to-r from-gray-50 to-blue-50 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary hover:scale-105 transition-transform duration-200" disabled={saving}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary min-w-[120px] justify-center hover:scale-105 transition-transform duration-200 shadow-lg">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : booking ? "Update Booking" : "Add Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
