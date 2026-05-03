"use client";
import { useEffect, useState } from "react";
import { CalendarDays, Clock, Phone, AlertCircle, CheckCircle, Plus } from "lucide-react";
import Link from "next/link";
import { formatPHP, formatDate, STATUS_COLOR, toYMD } from "@/lib/utils";
import type { Booking } from "@/lib/schema";

const UNIT_COLORS: Record<string, string> = {
  "1116": "border-l-blue-500",
  "1118": "border-l-emerald-500",
  "1558": "border-l-orange-500",
  "1845": "border-l-purple-500",
};
const UNIT_BADGE: Record<string, string> = {
  "1116": "bg-blue-50 text-blue-800",
  "1118": "bg-emerald-50 text-emerald-800",
  "1558": "bg-orange-50 text-orange-800",
  "1845": "bg-purple-50 text-purple-800",
};

function getDayLabel(dateStr: string, todayStr: string) {
  const target = new Date(`${dateStr}T12:00:00`);
  const today = new Date(`${todayStr}T12:00:00`);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return target.toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric" });
}

function timeToMinutes(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hours = Number(match[1]) % 12;
  const minutes = Number(match[2]);
  if (match[3].toUpperCase() === "PM") hours += 12;
  return hours * 60 + minutes;
}

export default function TomorrowPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((d) => { setBookings(d); setLoading(false); });
  }, []);

  const todayStr = toYMD(new Date());
  const today = new Date(`${todayStr}T12:00:00`);
  const todayLabel = today.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Build next 7 days
  const days = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const ds = toYMD(d);
    const dayBookings = bookings.filter((b) => {
      if (b.paymentStatus === "Canceled") return false;
      const ci = toYMD(b.checkIn);
      const co = toYMD(b.checkOut);
      return ci === ds || co === ds;
    });
    return { dateStr: ds, label: getDayLabel(ds, todayStr), bookings: dayBookings, index: i };
  }).filter((d) => d.bookings.length > 0 || d.index <= 1);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Schedule</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{todayLabel}</p>
        </div>
        <Link href="/bookings/new" className="btn-primary text-xs sm:text-sm px-3 py-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Booking</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      {days.map(({ dateStr, label, bookings: dayBookings, index }) => (
        <div key={dateStr}>
          <div className="flex items-center gap-3 mb-2">
            <div className={`text-sm font-semibold flex items-center gap-2 ${
              index === 0 ? "text-blue-700" : index === 1 ? "text-gray-900" : "text-gray-500"
            }`}>
              <CalendarDays className="w-4 h-4" />
              {label}
            </div>
            {index === 0 && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">Today</span>}
            {index === 1 && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">Tomorrow</span>}
            <div className="flex-1 h-px bg-gray-200" />
            {dayBookings.length > 0 && (
              <span className="text-xs text-gray-400">{dayBookings.length} booking{dayBookings.length > 1 ? "s" : ""}</span>
            )}
          </div>

          {dayBookings.length === 0 ? (
            <div className="card p-4 text-center text-gray-400 text-sm">No bookings — all units free</div>
          ) : (
            <div className="space-y-3">
              {(() => {
                const sortedBookings = [...dayBookings].sort((a, b) => {
                  const aIn = toYMD(a.checkIn) === dateStr;
                  const bIn = toYMD(b.checkIn) === dateStr;

                  const aTime = aIn ? a.checkInTime : a.checkOutTime;
                  const bTime = bIn ? b.checkInTime : b.checkOutTime;

                  const minuteDiff = timeToMinutes(aTime) - timeToMinutes(bTime);
                  if (minuteDiff !== 0) return minuteDiff;

                  const dateDiff = new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime();
                  if (dateDiff !== 0) return dateDiff;

                  return a.id - b.id;
                });

                const earliest = sortedBookings[0];
                const earliestIsIn = toYMD(earliest.checkIn) === dateStr;
                const earliestTime = earliestIsIn ? earliest.checkInTime : earliest.checkOutTime;
                const earliestType = earliestIsIn ? "Check-in" : "Check-out";

                return (
                  <>
                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs sm:text-sm flex items-center justify-between gap-2">
                      <span className="text-blue-700 font-medium">Earliest booking: {earliest.guestName} (Unit {earliest.unit})</span>
                      <span className="text-blue-800 font-semibold">{earliestType} {earliestTime}</span>
                    </div>

                    {sortedBookings.map((b) => {
                const ci = toYMD(b.checkIn);
                const co = toYMD(b.checkOut);
                const isIn = ci === dateStr;
                const isOut = co === dateStr;
                return (
                  <div key={b.id} className={`rounded-lg border-2 ${UNIT_COLORS[b.unit] ?? "border-gray-300"} shadow-md hover:shadow-lg transition-shadow p-4 sm:p-5 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-sm sm:text-base font-bold flex-shrink-0 ${UNIT_BADGE[b.unit] ?? "bg-gray-100 text-gray-700"}`}>
                        {b.unit}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-base sm:text-lg">{b.guestName}</h3>
                        <div className="mt-1.5 space-y-2">
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-600">
                            {b.contactNo && <span className="flex items-center gap-1 whitespace-nowrap"><Phone className="w-3.5 h-3.5 flex-shrink-0" />{b.contactNo}</span>}
                            <span className="flex items-center gap-1 whitespace-nowrap"><Clock className="w-3.5 h-3.5 flex-shrink-0" />{formatDate(b.checkIn)} – {formatDate(b.checkOut)}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="font-bold text-gray-900 text-base sm:text-lg">{formatPHP(b.totalFee)}</span>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR[b.paymentStatus] ?? ""}`}>
                              {b.paymentStatus}
                            </span>
                            {b.remainingBalance > 0 && (
                              <span className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-full font-semibold flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />{formatPHP(b.remainingBalance)} due
                              </span>
                            )}
                            {b.remainingBalance === 0 && (
                              <span className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-semibold flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" />Settled
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex gap-1.5 flex-col sm:flex-row">
                        {isIn && <span className="text-xs sm:text-sm px-3 py-1.5 bg-green-100 text-green-800 rounded-lg font-bold text-center whitespace-nowrap">Check-in {b.checkInTime}</span>}
                        {isOut && <span className="text-xs sm:text-sm px-3 py-1.5 bg-orange-100 text-orange-800 rounded-lg font-bold text-center whitespace-nowrap">Check-out {b.checkOutTime}</span>}
                      </div>
                      <Link
                        href={`/bookings?edit=${b.id}`}
                        className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                );
                    })}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
