"use client";
import { useEffect, useState } from "react";
import { Phone, Clock, AlertCircle, CheckCircle, Users, TrendingUp, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatPHP, formatDate, formatWeekRange, STATUS_COLOR, toYMD } from "@/lib/utils";

const UNIT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "1116": { bg: "bg-blue-50",   text: "text-blue-800",   dot: "bg-blue-500"   },
  "1118": { bg: "bg-emerald-50",text: "text-emerald-800",dot: "bg-emerald-500"},
  "1245": { bg: "bg-amber-50",  text: "text-amber-800",  dot: "bg-amber-500"  },
  "1558": { bg: "bg-orange-50", text: "text-orange-800", dot: "bg-orange-500" },
  "1845": { bg: "bg-purple-50", text: "text-purple-800", dot: "bg-purple-500" },
};

export default function TodayPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load. Please refresh."); setLoading(false); });
  }, []);

  const todayStr = toYMD(new Date());
  const today = new Date(`${todayStr}T12:00:00`);
  const todayLabel = today.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      <p className="text-sm text-gray-400">Loading today&apos;s guests...</p>
    </div>
  );

  if (error) return (
    <div className="card p-6 text-center text-red-600">{error}</div>
  );

  const { today: todayData, weekly } = data;
  const guests = todayData?.guests ?? [];
  const todayKey = todayData?.date ?? toYMD(new Date());
  const checkIns = guests.filter((g: any) => {
    const ci = toYMD(g.checkIn);
    return ci === todayKey;
  });
  const checkOuts = guests.filter((g: any) => {
    const co = toYMD(g.checkOut);
    const ci = toYMD(g.checkIn);
    return co === todayKey && ci !== todayKey;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Today&apos;s Guests</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{todayLabel}</p>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="stat-card text-center">
          <div className="text-2xl sm:text-3xl font-bold text-gray-900">{guests.length}</div>
          <div className="text-xs text-gray-500 font-medium">Total guests</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl sm:text-3xl font-bold text-green-700">{checkIns.length}</div>
          <div className="text-xs text-gray-500 font-medium">Check-ins</div>
        </div>
        <div className="stat-card text-center">
          <div className="text-2xl sm:text-3xl font-bold text-orange-600">{checkOuts.length}</div>
          <div className="text-xs text-gray-500 font-medium">Check-outs</div>
        </div>
      </div>

      {/* Today's guests list */}
      {guests.length === 0 ? (
        <div className="card p-8 sm:p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">No guests today</p>
          <p className="text-xs text-gray-400 mt-1">All units are free today</p>
          <Link href="/bookings/new" className="btn-primary mt-4 mx-auto w-fit">
            Add a booking
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Check-ins section */}
          {checkIns.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Check-ins today ({checkIns.length})
                </span>
              </div>
              <div className="space-y-2">
                {checkIns.map((g: any) => (
                  <GuestCard key={g.id} guest={g} type="checkin" todayStr={todayData.date} />
                ))}
              </div>
            </div>
          )}

          {/* Check-outs section */}
          {checkOuts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2 mt-4">
                <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Check-outs today ({checkOuts.length})
                </span>
              </div>
              <div className="space-y-2">
                {checkOuts.map((g: any) => (
                  <GuestCard key={g.id} guest={g} type="checkout" todayStr={todayData.date} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Weekly Revenue per Unit */}
      <div className="card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Weekly Revenue by Unit
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatWeekRange(weekly.startDate, weekly.endDate)}
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg sm:text-xl font-bold text-blue-700">{formatPHP(weekly.revenue)}</div>
            <div className="text-xs text-gray-400">{weekly.guests} guests this week</div>
          </div>
        </div>

        {/* Unit rows */}
        <div className="divide-y divide-gray-50">
          {weekly.perUnit.map((u: any) => {
            const uc = UNIT_COLORS[u.unitCode] ?? { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-400" };
            const maxRev = Math.max(...weekly.perUnit.map((x: any) => x.revenue), 1);
            const pct = Math.round((u.revenue / maxRev) * 100);
            return (
              <div key={u.unitCode} className="px-4 sm:px-5 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${uc.dot}`} />
                    <span className="text-sm font-medium text-gray-800">{u.unit}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${uc.bg} ${uc.text}`}>
                      {u.guests} guest{u.guests !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{formatPHP(u.revenue)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${uc.dot}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 sm:px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500">WEEK TOTAL</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{weekly.guests} guests</span>
            <span className="text-sm font-bold text-blue-700">{formatPHP(weekly.revenue)}</span>
          </div>
        </div>
      </div>

      {/* Link to full dashboard */}
      <Link href="/" className="flex items-center justify-between card p-4 hover:bg-gray-50 transition-colors group">
        <span className="text-sm font-medium text-gray-700">View full dashboard & analytics</span>
        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
      </Link>
    </div>
  );
}

function GuestCard({ guest, type, todayStr }: { guest: any; type: "checkin" | "checkout"; todayStr: string }) {
  const uc = UNIT_COLORS[guest.unit] ?? { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-400" };
  const isCheckIn = type === "checkin";

  return (
    <div className={`card p-3 sm:p-4 flex items-start gap-3 border-l-4 ${isCheckIn ? "border-l-green-500" : "border-l-orange-400"}`}>
      {/* Unit badge */}
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0 ${uc.bg} ${uc.text}`}>
        {guest.unit}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">{guest.guestName}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLOR[guest.paymentStatus] ?? "bg-gray-100 text-gray-600"}`}>
            {guest.paymentStatus}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
          {guest.contactNo && (
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" />{guest.contactNo}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {isCheckIn ? `In: ${guest.checkInTime}` : `Out: ${guest.checkOutTime}`}
          </span>
          <span className="font-medium text-gray-700">{formatPHP(guest.totalFee)}</span>
        </div>

        {guest.remainingBalance > 0 && (
          <div className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-600">
            <AlertCircle className="w-3 h-3" />
            Balance due: {formatPHP(guest.remainingBalance)}
          </div>
        )}
        {guest.remainingBalance === 0 && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="w-3 h-3" />
            Fully settled
          </div>
        )}
      </div>
    </div>
  );
}
