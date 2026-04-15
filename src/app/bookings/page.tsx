"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, Filter, Pencil, Trash2, AlertTriangle, CheckCircle, Phone } from "lucide-react";
import BookingForm from "@/components/BookingForm";
import { emitBookingsChanged } from "@/lib/bookings-sync";
import { formatPHP, formatDate, STATUS_COLOR, UNITS, toYMD } from "@/lib/utils";
import type { Booking } from "@/lib/schema";

function BookingsContent() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [units, setUnits] = useState<string[]>(UNITS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateScope, setFilterDateScope] = useState("upcoming");
  const [filterDpReceiver, setFilterDpReceiver] = useState("");
  const [filterFpReceiver, setFilterFpReceiver] = useState("");
  const [filterWeek, setFilterWeek] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [receivers, setReceivers] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const fetchBookings = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterUnit) params.set("unit", filterUnit);
    if (filterStatus) params.set("status", filterStatus);
    params.set("view", filterDateScope);
    const res = await fetch(`/api/bookings?${params}`, { cache: "no-store" });
    const data = await res.json();
    setBookings(data);
    setLoading(false);
  };

  useEffect(() => { fetchBookings(); }, [filterUnit, filterStatus, filterDateScope]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.units) && d.units.length > 0) setUnits(d.units);
        if (Array.isArray(d.receiverPersons)) {
          setReceivers(d.receiverPersons.map((p: any) => p.name));
        }
      })
      .catch(() => {});
  }, []);

  // Support ?edit=ID from other pages
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && bookings.length > 0) {
      const b = bookings.find((x) => x.id === Number(editId));
      if (b) { setEditBooking(b); setShowForm(true); }
    }
  }, [searchParams, bookings]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this booking? This cannot be undone.")) return;
    await fetch(`/api/bookings/${id}`, { method: "DELETE" });
    emitBookingsChanged();
    fetchBookings();
  };

  const filtered = bookings.filter((b) => {
    const q = search.toLowerCase();
    const matchesSearch = (
      b.guestName.toLowerCase().includes(q) ||
      b.unit.includes(q) ||
      (b.contactNo ?? "").includes(q)
    );

    if (!matchesSearch) return false;

    if (filterDpReceiver && b.dpReceivedBy !== filterDpReceiver) return false;
    if (filterFpReceiver && b.fpReceivedBy !== filterFpReceiver) return false;

    if (filterWeek) {
      const weekStart = new Date(filterWeek);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const checkInDate = new Date(b.checkIn);
      if (checkInDate < weekStart || checkInDate > weekEnd) return false;
    }

    if (filterMonth) {
      const [year, month] = filterMonth.split("-");
      const checkInDate = new Date(b.checkIn);
      if (checkInDate.getFullYear() !== Number(year) || (checkInDate.getMonth() + 1) !== Number(month)) return false;
    }

    return true;
  });

  const timeToMinutes = (time: string) => {
    const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return Number.MAX_SAFE_INTEGER;
    let hours = Number(match[1]) % 12;
    const minutes = Number(match[2]);
    if (match[3].toUpperCase() === "PM") hours += 12;
    return hours * 60 + minutes;
  };

  const groupedBookings = [...filtered]
    .sort((a, b) => {
      const dateDiff = new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime();
      if (dateDiff !== 0) return dateDiff;
      return timeToMinutes(a.checkInTime) - timeToMinutes(b.checkInTime);
    })
    .reduce((groups, booking) => {
      const dateKey = booking.checkInDateKey || toYMD(booking.checkIn);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(booking);
      return groups;
    }, {} as Record<string, Booking[]>);

  const groupedDates = Object.keys(groupedBookings).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">All Bookings</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{bookings.length} total bookings</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 sm:p-4 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Search guest, unit, contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select className="input text-xs" value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}>
            <option value="">All units</option>
            {units.map((u) => <option key={u} value={u}>Unit {u}</option>)}
          </select>
          <select className="input text-xs" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All status</option>
            <option value="Fully Paid">Fully Paid</option>
            <option value="DP Paid">DP Paid</option>
            <option value="No DP">No DP</option>
          </select>
          <select className="input text-xs" value={filterDateScope} onChange={(e) => setFilterDateScope(e.target.value)}>
            <option value="all">All dates</option>
            <option value="upcoming">Upcoming/current</option>
            <option value="past">Past records</option>
          </select>
          <input type="month" className="input text-xs" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} placeholder="Month" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <select className="input text-xs" value={filterDpReceiver} onChange={(e) => setFilterDpReceiver(e.target.value)}>
            <option value="">DP receiver</option>
            {receivers.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="input text-xs" value={filterFpReceiver} onChange={(e) => setFilterFpReceiver(e.target.value)}>
            <option value="">FP receiver</option>
            {receivers.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input type="week" className="input text-xs" value={filterWeek} onChange={(e) => setFilterWeek(e.target.value)} placeholder="Week" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 card">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : groupedDates.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">No bookings match your filters</div>
      ) : (
        <div className="space-y-4">
          {groupedDates.map((dateKey) => {
            const dayBookings = groupedBookings[dateKey];
            return (
              <div key={dateKey} className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="text-sm sm:text-base font-semibold text-gray-900">
                    {new Date(dateKey).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}
                  </div>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">{dayBookings.length} booking{dayBookings.length > 1 ? "s" : ""}</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {dayBookings.map((b) => (
                    <div key={b.id} className="card p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{b.guestName}</p>
                          {b.contactNo && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" />{b.contactNo}
                            </p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLOR[b.paymentStatus] ?? ""}`}>
                          {b.paymentStatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 mb-2">
                        <span><span className="text-gray-400">Unit</span> {b.unit}</span>
                        <span><span className="text-gray-400">Fee</span> {formatPHP(b.totalFee)}</span>
                        <span><span className="text-gray-400">In</span> {formatDate(b.checkIn)} {b.checkInTime}</span>
                        <span><span className="text-gray-400">Balance</span> <span className={b.remainingBalance > 0 ? "text-red-600 font-semibold" : "text-green-600"}>{formatPHP(b.remainingBalance)}</span></span>
                        <span><span className="text-gray-400">Out</span> {formatDate(b.checkOut)} {b.checkOutTime}</span>
                        <span>
                          {b.hasConflict === "✅ OK"
                            ? <span className="text-green-600 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> OK</span>
                            : <span className="text-red-600 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> Conflict</span>
                          }
                        </span>
                        {b.dpReceivedBy && (
                          <span><span className="text-gray-400">DP To</span> <span className="font-medium text-blue-600">{b.dpReceivedBy}</span></span>
                        )}
                        {b.fpReceivedBy && (
                          <span><span className="text-gray-400">FP To</span> <span className="font-medium text-purple-600">{b.fpReceivedBy}</span></span>
                        )}
                      </div>

                      <div className="flex gap-2 border-t border-gray-100 pt-2">
                        <button
                          onClick={() => { setEditBooking(b); setShowForm(true); }}
                          className="flex-1 btn-secondary text-xs py-1.5 justify-center"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="flex-1 btn-danger text-xs py-1.5 justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <BookingForm
          booking={editBooking}
          onClose={() => { setShowForm(false); setEditBooking(null); router.replace("/bookings"); }}
          onSaved={fetchBookings}
        />
      )}
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <BookingsContent />
    </Suspense>
  );
}
