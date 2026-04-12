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

export function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-PH", {
    timeZone: PH_TIME_ZONE,
    year: "numeric", month: "short", day: "numeric",
  });
}

export const UNITS = ["1116", "1118", "1245", "1558", "1845"];
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
