export function calcPaymentStatus(dp: number, fp: number, total: number): string {
  const paid = dp + fp;
  if (paid >= total) return "Fully Paid";
  if (dp > 0) return "DP Paid";
  return "No DP";
}

export function calcRemaining(dp: number, fp: number, total: number): number {
  return Math.max(0, total - dp - fp);
}

const PH_TIME_ZONE = "Asia/Manila";

const phDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PH_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const phMonthFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: PH_TIME_ZONE,
  month: "short",
});

export function formatPHP(amount: number): string {
  return "₱" + Number(amount).toLocaleString("en-PH");
}

export function toYMD(date: string | Date | null | undefined): string {
  if (!date) return "";

  const parts = phDateFormatter.formatToParts(new Date(date));
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export function parseTimeToMinutes(time: string | null | undefined): number {
  if (!time) return 0;
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;

  let hours = Number(match[1]) % 12;
  const minutes = Number(match[2]);
  if (match[3].toUpperCase() === "PM") hours += 12;
  return hours * 60 + minutes;
}

function ymdToDayNumber(ymd: string): number {
  const [year, month, day] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

export function toAbsoluteMinutes(date: string | Date, time: string | null | undefined): number {
  const dayNumber = ymdToDayNumber(toYMD(date));
  return dayNumber * 1440 + parseTimeToMinutes(time);
}

export function hasUnitTimeConflict(
  a: { checkIn: string | Date; checkInTime?: string | null; checkOut: string | Date; checkOutTime?: string | null },
  b: { checkIn: string | Date; checkInTime?: string | null; checkOut: string | Date; checkOutTime?: string | null },
  minGapMinutes = 60
): boolean {
  const aStart = toAbsoluteMinutes(a.checkIn, a.checkInTime);
  const aEndRaw = toAbsoluteMinutes(a.checkOut, a.checkOutTime);
  const bStart = toAbsoluteMinutes(b.checkIn, b.checkInTime);
  const bEndRaw = toAbsoluteMinutes(b.checkOut, b.checkOutTime);

  const aEnd = Math.max(aStart, aEndRaw);
  const bEnd = Math.max(bStart, bEndRaw);

  const hasEnoughGap = aEnd + minGapMinutes <= bStart || bEnd + minGapMinutes <= aStart;
  return !hasEnoughGap;
}

export function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PH_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function dayNumberToYMD(dayNumber: number): string {
  const date = new Date(dayNumber * 86400000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseYMDToPHDate(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  return new Date(`${value}T00:00:00+08:00`);
}

function toPhNoonDate(date: string | Date): Date {
  return parseYMDToPHDate(date);
}

export function formatWeekRange(startDate: string | Date, endDate: string | Date): string {
  const start = toPhNoonDate(startDate);
  const end = toPhNoonDate(endDate);

  const startMonth = phMonthFormatter.format(start);
  const endMonth = phMonthFormatter.format(end);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    return `${startMonth} ${start.getDate()} - ${end.getDate()}`;
  }

  if (sameYear) {
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
  }

  return `${startMonth} ${start.getDate()}, ${start.getFullYear()} - ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
}

export function getSundayToSaturdayWeek(date: string | Date) {
  const anchorYMD = toYMD(date);
  const anchorDayNumber = ymdToDayNumber(anchorYMD);
  const [y, m, d] = anchorYMD.split("-").map(Number);
  const anchorDow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  const weekStartYMD = dayNumberToYMD(anchorDayNumber - anchorDow);
  const weekEndYMD = dayNumberToYMD(anchorDayNumber - anchorDow + 6);
  const weekStart = parseYMDToPHDate(weekStartYMD);
  const weekEnd = parseYMDToPHDate(weekEndYMD);

  return {
    start: weekStart,
    end: weekEnd,
    startDate: weekStartYMD,
    endDate: weekEndYMD,
    label: formatWeekRange(weekStart, weekEnd),
  };
}

export const UNITS = ["1116", "1118", "1245", "1558", "1845", "2208", "2209"];
export const PAYMENT_METHODS = ["Cash", "GCash", "Bank Transfer"];
export const STAFF = ["SIR JAMES", "SIR MIKE", "RIEMAR"];

export const STATUS_COLOR: Record<string, string> = {
  "Fully Paid": "bg-green-100 text-green-800",
  "DP Paid":    "bg-yellow-100 text-yellow-800",
  "No DP":      "bg-red-100 text-red-800",
};

export const UNIT_COLORS: Record<string, string> = {
  "1116": "#3b82f6",
  "1118": "#10b981",
  "1245": "#f59e0b",
  "1558": "#ef4444",
  "1845": "#8b5cf6",
};
