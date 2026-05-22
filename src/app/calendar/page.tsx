"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { UNITS, UNIT_COLORS } from "@/lib/utils";

interface Booking {
  id: number;
  unit: string;
  checkIn: string;
  checkOut: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  guestName: string;
  status?: string;
}

export default function CalendarPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data) => {
        setBookings(Array.isArray(data) ? data : []);
      })
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, []);

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  // Calculate total bookings for current month
  const getTotalBookingsForMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    return bookings.filter((booking) => {
      const checkIn = new Date(booking.checkIn);
      return checkIn.getFullYear() === year && checkIn.getMonth() === month;
    }).length;
  };

  const totalBookings = getTotalBookingsForMonth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Unit Availability Calendar</h1>
        <Link href="/" className="text-xs text-blue-600 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Month Navigation */}
      <div className="card p-4 flex items-center justify-between">
        <button
          onClick={goToPreviousMonth}
          className="btn-secondary flex items-center gap-2 py-2 px-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">
            {currentMonth.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}
          </h2>
          <button
            onClick={goToToday}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            Today
          </button>
        </div>

        <button
          onClick={goToNextMonth}
          className="btn-secondary flex items-center gap-2 py-2 px-4"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Total Bookings Counter */}
      <div className="card p-5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90 uppercase tracking-wide">Total Bookings This Month</p>
            <p className="text-4xl font-bold mt-1">{totalBookings}</p>
          </div>
          <div className="text-6xl opacity-20">📅</div>
        </div>
      </div>

      {/* Legend */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Legend</p>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-500 rounded border-2 border-green-600"></div>
            <span className="text-sm text-gray-700">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-yellow-500 rounded border-2 border-yellow-600"></div>
            <span className="text-sm text-gray-700">Partially Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-red-500 rounded border-2 border-red-600"></div>
            <span className="text-sm text-gray-700">Fully Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-200 rounded border-2 border-gray-300"></div>
            <span className="text-sm text-gray-700">Other Month</span>
          </div>
        </div>
      </div>

      {/* Calendars Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {UNITS.map((unit) => (
          <UnitCalendar
            key={unit}
            unit={unit}
            bookings={bookings.filter((b) => String(b.unit).replace(/^Unit\s*/i, "") === unit)}
            currentMonth={currentMonth}
          />
        ))}
      </div>
    </div>
  );
}

interface UnitCalendarProps {
  unit: string;
  bookings: Booking[];
  currentMonth: Date;
}

function UnitCalendar({ unit, bookings, currentMonth }: UnitCalendarProps) {
  const unitColor = UNIT_COLORS[unit] || "#6b7280";
  
  // Get calendar data
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  // First day of the month
  const firstDay = new Date(year, month, 1);
  const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
  
  // Last day of the month
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  // Previous month days to show
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const prevMonthDays = startingDayOfWeek;
  
  // Next month days to show
  const totalCells = Math.ceil((daysInMonth + startingDayOfWeek) / 7) * 7;
  const nextMonthDays = totalCells - (daysInMonth + startingDayOfWeek);
  
  // Check if a date is booked (returns: 'full', 'partial', or 'available')
  const getDateStatus = (date: Date): { status: 'full' | 'partial' | 'available'; availableTime?: string } => {
    // Create fresh date copies without modifying originals
    const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const bookingsOnDate = bookings.filter((booking) => {
      const checkInDate = new Date(booking.checkIn);
      const checkOutDate = new Date(booking.checkOut);
      
      checkInDate.setHours(0, 0, 0, 0);
      checkOutDate.setHours(0, 0, 0, 0);
      
      return checkDate >= checkInDate && checkDate <= checkOutDate;
    });
    
    if (bookingsOnDate.length === 0) return { status: 'available' };
    
    // Check if any booking is partial (has specific check-in/out times that don't cover full day)
    for (const booking of bookingsOnDate) {
      const checkInDate = new Date(booking.checkIn);
      const checkOutDate = new Date(booking.checkOut);
      
      checkInDate.setHours(0, 0, 0, 0);
      checkOutDate.setHours(0, 0, 0, 0);
      
      // If it's check-in day and has a late check-in time (after 12 PM)
      if (checkDate.getTime() === checkInDate.getTime() && booking.checkInTime) {
        const checkInHour = parseInt(booking.checkInTime.split(':')[0]);
        const isPM = booking.checkInTime.toUpperCase().includes('PM');
        const hour24 = isPM && checkInHour !== 12 ? checkInHour + 12 : checkInHour;
        if (hour24 >= 14) {
          // Available before check-in time
          return { status: 'partial', availableTime: `Until ${booking.checkInTime}` };
        }
      }
      
      // If it's check-out day and has an early check-out time (before 12 PM)
      if (checkDate.getTime() === checkOutDate.getTime() && booking.checkOutTime) {
        const checkOutHour = parseInt(booking.checkOutTime.split(':')[0]);
        const isPM = booking.checkOutTime.toUpperCase().includes('PM');
        const hour24 = isPM && checkOutHour !== 12 ? checkOutHour + 12 : checkOutHour;
        if (hour24 <= 14) {
          // Available after check-out time
          return { status: 'partial', availableTime: `From ${booking.checkOutTime}` };
        }
      }
    }
    
    return { status: 'full' };
  };
  
  // Get booking info for a date
  const getBookingInfo = (date: Date): Booking[] => {
    // Create fresh date copy without modifying original
    const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    return bookings.filter((booking) => {
      const checkInDate = new Date(booking.checkIn);
      const checkOutDate = new Date(booking.checkOut);
      
      checkInDate.setHours(0, 0, 0, 0);
      checkOutDate.setHours(0, 0, 0, 0);
      
      return checkDate >= checkInDate && checkDate <= checkOutDate;
    });
  };
  
  // Build calendar days
  const calendarDays: Array<{ date: Date; isCurrentMonth: boolean }> = [];
  
  // Previous month days
  for (let i = prevMonthDays - 1; i >= 0; i--) {
    calendarDays.push({
      date: new Date(year, month - 1, prevMonthLastDay - i),
      isCurrentMonth: false,
    });
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }
  
  // Next month days
  for (let i = 1; i <= nextMonthDays; i++) {
    calendarDays.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return (
    <div className="card p-5 border-2 shadow-lg hover:shadow-xl transition-all duration-300" style={{ borderColor: unitColor }}>
      {/* Unit Header */}
      <div 
        className="text-white px-4 py-3 rounded-lg mb-4 shadow-md"
        style={{ background: `linear-gradient(135deg, ${unitColor} 0%, ${unitColor}dd 100%)` }}
      >
        <h2 className="text-lg font-bold">Unit {unit}</h2>
        <p className="text-xs opacity-90 mt-0.5">
          {bookings.length} booking{bookings.length !== 1 ? "s" : ""} this month
        </p>
      </div>
      
      {/* Calendar Grid */}
      <div className="space-y-2">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-gray-600 py-1">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const dateStatusInfo = getDateStatus(day.date);
            const dateStatus = dateStatusInfo.status;
            const availableTime = dateStatusInfo.availableTime;
            const isToday = day.date.getTime() === today.getTime();
            const bookingInfos = getBookingInfo(day.date);
            
            let bgColor = "bg-green-500 hover:bg-green-600";
            let borderColor = "border-green-600";
            let textColor = "text-white";
            
            if (dateStatus === 'partial') {
              bgColor = "bg-yellow-500 hover:bg-yellow-600";
              borderColor = "border-yellow-600";
              textColor = "text-white";
            } else if (dateStatus === 'full') {
              bgColor = "bg-red-500 hover:bg-red-600";
              borderColor = "border-red-600";
              textColor = "text-white";
            }
            
            if (!day.isCurrentMonth) {
              bgColor = "bg-gray-200";
              borderColor = "border-gray-300";
              textColor = "text-gray-500";
            }
            
            const tooltipText = bookingInfos.length > 0
              ? bookingInfos.map(b => 
                  `${b.guestName}\n` +
                  `In: ${new Date(b.checkIn).toLocaleDateString()}${b.checkInTime ? ' ' + b.checkInTime : ''}\n` +
                  `Out: ${new Date(b.checkOut).toLocaleDateString()}${b.checkOutTime ? ' ' + b.checkOutTime : ''}`
                ).join('\n---\n')
              : day.isCurrentMonth
              ? "Available"
              : "";
            
            return (
              <div
                key={index}
                className={`
                  relative aspect-square flex flex-col items-center justify-center
                  rounded border-2 transition-all cursor-pointer
                  ${bgColor} ${borderColor} ${textColor}
                  ${isToday ? "ring-4 ring-blue-400 ring-offset-1" : ""}
                  ${day.isCurrentMonth ? "font-semibold" : "font-normal"}
                  ${dateStatus === 'partial' ? 'p-0.5' : ''}
                `}
                title={tooltipText}
              >
                <span className="text-sm">{day.date.getDate()}</span>
                {isToday && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                )}
                {dateStatus === 'partial' && day.isCurrentMonth && availableTime && (
                  <div className="absolute bottom-0 left-0 right-0 bg-white/90 text-yellow-800 text-[7px] font-bold text-center py-0.5 rounded-b leading-tight">
                    {availableTime}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Bookings List */}
      {bookings.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
            Bookings This Month
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="text-xs bg-gray-50 rounded p-2 border border-gray-200"
              >
                <p className="font-semibold text-gray-900">{booking.guestName}</p>
                <p className="text-gray-600">
                  {new Date(booking.checkIn).toLocaleDateString("en-PH", { month: "short", day: "numeric" })} - {new Date(booking.checkOut).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
