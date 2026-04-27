"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, Filter, Pencil, Trash2, AlertTriangle, CheckCircle, Phone, Download, Ban, RotateCcw } from "lucide-react";
import * as XLSX from "xlsx";
import BookingForm from "@/components/BookingForm";
import { emitBookingsChanged } from "@/lib/bookings-sync";
import { formatPHP, formatDate, STATUS_COLOR, UNITS, toYMD, normalizeBookingSource } from "@/lib/utils";
import type { Booking } from "@/lib/schema";

function BookingSourceBadge({ source }: { source: string | null | undefined }) {
  const normalized = normalizeBookingSource(source);

  if (normalized === "TikTok") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-black px-2 py-0.5 text-[10px] font-semibold text-white">
        <span className="text-cyan-300">♪</span>
        TikTok
      </span>
    );
  }

  if (normalized === "Facebook") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">f</span>
        Facebook
      </span>
    );
  }

  if (normalized === "Airbnb") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">A</span>
        Airbnb
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
      Direct
    </span>
  );
}

function BookingsContent() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [units, setUnits] = useState<string[]>(UNITS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateScope, setFilterDateScope] = useState("upcoming");
  const [filterSource, setFilterSource] = useState("");
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

  const handleCancelBooking = async (id: number) => {
    if (!confirm("Mark this booking as Canceled?")) return;
    await fetch(`/api/bookings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: "Canceled" }),
    });
    emitBookingsChanged();
    fetchBookings();
  };

  const handleRestoreBooking = async (id: number) => {
    if (!confirm("Undo canceled status for this booking?")) return;
    await fetch(`/api/bookings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: "Restore" }),
    });
    emitBookingsChanged();
    fetchBookings();
  };

  const exportToExcel = () => {
    if (filtered.length === 0) {
      alert("No bookings to export.");
      return;
    }

    const exportData = filtered.map((b) => ({
      "Guest Name": b.guestName,
      "Source": normalizeBookingSource(b.bookingSource),
      "Unit": b.unit,
      "Phone": b.contactNo || "",
      "Check In": formatDate(b.checkIn),
      "Check In Time": b.checkInTime,
      "Check Out": formatDate(b.checkOut),
      "Check Out Time": b.checkOutTime,
      "Total Fee": b.totalFee,
      "DP Amount": b.dpAmount || 0,
      "FP Amount": b.fpAmount || 0,
      "Payment Status": b.paymentStatus,
      "Remaining Balance": b.remainingBalance,
      "DP Received By": b.dpReceivedBy || "",
      "FP Received By": b.fpReceivedBy || "",
      "Conflict": b.hasConflict === "✅ OK" ? "OK" : "Conflict",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bookings");

    ws["!cols"] = [
      { wch: 20 },
      { wch: 12 },
      { wch: 10 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
    ];

    const fileName = `bookings_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const filtered = bookings.filter((b) => {
    const q = search.toLowerCase();
    const matchesSearch = (
      b.guestName.toLowerCase().includes(q) ||
      b.unit.includes(q) ||
      (b.contactNo ?? "").includes(q)
    );

    if (!matchesSearch) return false;

    if (filterSource && normalizeBookingSource(b.bookingSource) !== filterSource) return false;

    if (filterDpReceiver && b.dpReceivedBy !== filterDpReceiver) return false;
    if (filterFpReceiver && b.fpReceivedBy !== filterFpReceiver) return false;

    if (filterWeek) {
      // Anchor week by selected date, then force Sunday-Saturday bounds.
      const weekStart = new Date(`${filterWeek}T12:00:00`);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
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

  // Calculate booking count per guest
  const guestBookingCounts = bookings.reduce((counts, booking) => {
    const name = booking.guestName.toLowerCase();
    counts[name] = (counts[name] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  const getBookingCountBadge = (guestName: string) => {
    const count = guestBookingCounts[guestName.toLowerCase()] || 1;
    if (count === 1) {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">1st booking</span>;
    } else if (count === 2) {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">2nd booking</span>;
    } else if (count === 3) {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">3rd booking</span>;
    } else {
      return <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Returning ({count}x)</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">All Bookings</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{bookings.length} total bookings</p>
        </div>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition"
        >
          <Download className="w-4 h-4" />
          Transfer to Excel
        </button>
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
            <option value="Canceled">Canceled</option>
          </select>
          <select className="input text-xs" value={filterDateScope} onChange={(e) => setFilterDateScope(e.target.value)}>
            <option value="all">All dates</option>
            <option value="upcoming">Upcoming/current</option>
            <option value="past">Past records</option>
          </select>
          <input type="month" className="input text-xs" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} placeholder="Month" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select className="input text-xs" value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
            <option value="">All sources</option>
            <option value="Direct">Direct</option>
            <option value="TikTok">TikTok</option>
            <option value="Facebook">Facebook</option>
            <option value="Airbnb">Airbnb</option>
          </select>
          <select className="input text-xs" value={filterDpReceiver} onChange={(e) => setFilterDpReceiver(e.target.value)}>
            <option value="">DP receiver</option>
            {receivers.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="input text-xs" value={filterFpReceiver} onChange={(e) => setFilterFpReceiver(e.target.value)}>
            <option value="">FP receiver</option>
            {receivers.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input
            type="date"
            className="input text-xs"
            value={filterWeek}
            onChange={(e) => setFilterWeek(e.target.value)}
            title="Pick any date inside the week (Sunday to Saturday)"
          />
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 truncate">{b.guestName}</p>
                            <BookingSourceBadge source={b.bookingSource} />
                            {getBookingCountBadge(b.guestName)}
                          </div>
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
                        {b.paymentStatus !== "Canceled" && (
                          <button
                            onClick={() => handleCancelBooking(b.id)}
                            className="flex-1 btn-secondary text-xs py-1.5 justify-center text-gray-700"
                          >
                            <Ban className="w-3.5 h-3.5" /> Canceled
                          </button>
                        )}
                        {b.paymentStatus === "Canceled" && (
                          <button
                            onClick={() => handleRestoreBooking(b.id)}
                            className="flex-1 btn-secondary text-xs py-1.5 justify-center text-blue-700"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Undo Cancel
                          </button>
                        )}
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
          onSaved={() => { emitBookingsChanged(); fetchBookings(); }}
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
