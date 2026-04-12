"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate, toYMD } from "@/lib/utils";
import type { Booking } from "@/lib/schema";

function timeToMinutes(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hours = Number(match[1]) % 12;
  const minutes = Number(match[2]);
  if (match[3].toUpperCase() === "PM") hours += 12;
  return hours * 60 + minutes;
}

export default function CalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [anchorMonth, setAnchorMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => toYMD(new Date()));

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setBookings(d);
      })
      .finally(() => setLoading(false));
  }, []);

  const monthLabel = anchorMonth.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });

  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth(), 1);
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      const dayKey = toYMD(day);

      const checkIns = bookings.filter((b) => toYMD(b.checkIn) === dayKey);
      const checkOuts = bookings.filter((b) => toYMD(b.checkOut) === dayKey);
      const occupiedUnits = Array.from(new Set(
        bookings
          .filter((b) => dayKey >= toYMD(b.checkIn) && dayKey <= toYMD(b.checkOut))
          .map((b) => b.unit)
      )).sort();

      return {
        day,
        dayKey,
        inCurrentMonth: day.getMonth() === anchorMonth.getMonth(),
        checkIns,
        checkOuts,
        occupiedUnits,
      };
    });
  }, [anchorMonth, bookings]);

  const selected = useMemo(() => {
    return calendarDays.find((d) => d.dayKey === selectedDate) ?? null;
  }, [calendarDays, selectedDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">All Units Calendar</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Monthly view for all check-ins, check-outs, and occupied units</p>
        </div>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            type="button"
            className="btn-secondary text-xs py-1.5"
            onClick={() => setAnchorMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>

          <div className="text-center">
            <p className="text-sm sm:text-base font-semibold text-gray-900">{monthLabel}</p>
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={() => {
                const now = new Date();
                setAnchorMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelectedDate(toYMD(now));
              }}
            >
              Jump to today
            </button>
          </div>

          <button
            type="button"
            className="btn-secondary text-xs py-1.5"
            onClick={() => setAnchorMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
            <div key={label} className="text-[11px] sm:text-xs font-semibold text-gray-500 text-center py-1">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((dayInfo) => {
            const isSelected = dayInfo.dayKey === selectedDate;
            const isToday = dayInfo.dayKey === toYMD(new Date());
            return (
              <button
                key={dayInfo.dayKey}
                type="button"
                onClick={() => setSelectedDate(dayInfo.dayKey)}
                className={`rounded-lg border p-1.5 sm:p-2 text-left min-h-[88px] sm:min-h-[104px] transition-colors ${
                  isSelected
                    ? "border-blue-400 bg-blue-50"
                    : dayInfo.inCurrentMonth
                      ? "border-gray-200 bg-white hover:bg-gray-50"
                      : "border-gray-100 bg-gray-50 text-gray-400"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] sm:text-xs font-semibold ${isToday ? "text-blue-700" : "text-gray-700"}`}>
                    {dayInfo.day.getDate()}
                  </span>
                  {isToday && <CalendarDays className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <div className="space-y-0.5">
                  {dayInfo.checkIns.length > 0 && (
                    <div className="text-[10px] sm:text-[11px] px-1 py-0.5 rounded bg-green-100 text-green-800 font-medium">
                      In {dayInfo.checkIns.length}
                    </div>
                  )}
                  {dayInfo.checkOuts.length > 0 && (
                    <div className="text-[10px] sm:text-[11px] px-1 py-0.5 rounded bg-orange-100 text-orange-800 font-medium">
                      Out {dayInfo.checkOuts.length}
                    </div>
                  )}
                  {dayInfo.occupiedUnits.length > 0 && (
                    <div className="text-[10px] sm:text-[11px] px-1 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                      Units {dayInfo.occupiedUnits.length}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="card p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900">{new Date(`${selected.dayKey}T12:00:00`).toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h2>
            <span className="text-xs text-gray-500">Occupied units: {selected.occupiedUnits.length}</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {selected.occupiedUnits.length === 0 ? (
              <span className="text-xs text-gray-400">No occupied units</span>
            ) : (
              selected.occupiedUnits.map((unit) => (
                <span key={unit} className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Unit {unit}</span>
              ))
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700 mb-2">Check-ins ({selected.checkIns.length})</p>
              {selected.checkIns.length === 0 ? (
                <p className="text-xs text-green-700/70">No check-ins</p>
              ) : (
                <div className="space-y-1.5">
                  {[...selected.checkIns]
                    .sort((a, b) => timeToMinutes(a.checkInTime) - timeToMinutes(b.checkInTime))
                    .map((b) => (
                      <div key={`in-${b.id}`} className="text-xs text-green-900">
                        <span className="font-semibold">{b.checkInTime}</span> - {b.guestName} (Unit {b.unit})
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 mb-2">Check-outs ({selected.checkOuts.length})</p>
              {selected.checkOuts.length === 0 ? (
                <p className="text-xs text-orange-700/70">No check-outs</p>
              ) : (
                <div className="space-y-1.5">
                  {[...selected.checkOuts]
                    .sort((a, b) => timeToMinutes(a.checkOutTime) - timeToMinutes(b.checkOutTime))
                    .map((b) => (
                      <div key={`out-${b.id}`} className="text-xs text-orange-900">
                        <span className="font-semibold">{b.checkOutTime}</span> - {b.guestName} (Unit {b.unit})
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Selected day includes stays from <span className="font-medium text-gray-700">{selected.checkIns.length + selected.checkOuts.length}</span> booking event(s).
          </div>
        </div>
      )}
    </div>
  );
}
