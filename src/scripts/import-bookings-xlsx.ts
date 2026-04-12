import { config } from "dotenv";
import * as XLSX from "xlsx";
import { and, eq } from "drizzle-orm";

config({ path: ".env.local" });

const DEFAULT_UNIT = "1116";
const DEFAULT_CHECKIN_TIME = "2:00 PM";
const DEFAULT_CHECKOUT_TIME = "12:00 PM";

function toNumber(value: unknown): number {
  if (value == null) return 0;
  const s = String(value).replace(/[^\d.-]/g, "").trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizePhone(value: unknown): string | null {
  if (value == null) return null;
  const cleaned = String(value).trim();
  return cleaned ? cleaned : null;
}

function parseDate(value: unknown): Date | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const month = Number(m[1]) - 1;
    const day = Number(m[2]);
    const year = Number(m[3]);
    const parsed = new Date(year, month, day);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function normalizeTime(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  const raw = String(value).trim();
  if (!raw) return fallback;

  // Normalize variants like "2:00PM", "3pm", "2: 00 PM".
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  const withSpacer = compact.replace(/(AM|PM)$/i, " $1");
  const m = withSpacer.match(/^(\d{1,2})(?::(\d{2}))?\s(AM|PM)$/i);
  if (!m) return raw;

  const hh = Number(m[1]);
  const mm = Number(m[2] ?? "0");
  const ampm = m[3].toUpperCase();
  if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return raw;
  return `${hh}:${String(mm).padStart(2, "0")} ${ampm}`;
}

function normalizeUnit(value: unknown): string {
  const raw = String(value ?? "").replace(/^Unit\s*/i, "").trim();
  return raw || DEFAULT_UNIT;
}

function splitFpFields(a: unknown, b: unknown): { fpMethod: string | null; fpReceivedBy: string | null } {
  const left = String(a ?? "").trim();
  const right = String(b ?? "").trim();
  const looksLikeMethod = (v: string) => /cash|gcash|maya|bank|instapay|transfer|card/i.test(v);

  let fpMethod: string | null = null;
  let fpReceivedBy: string | null = null;

  if (looksLikeMethod(left) && !looksLikeMethod(right)) {
    fpMethod = left || null;
    fpReceivedBy = right || null;
  } else if (!looksLikeMethod(left) && looksLikeMethod(right)) {
    fpMethod = right || null;
    fpReceivedBy = left || null;
  } else {
    fpMethod = left || null;
    fpReceivedBy = right || null;
  }

  return { fpMethod, fpReceivedBy };
}

async function run() {
  const filePath = process.argv[2] || "c:/Users/reyn/Downloads/BOOKINGS.xlsx";

  const { db } = await import("../lib/db");
  const { bookings } = await import("../lib/schema");
  const { calcPaymentStatus, calcRemaining } = await import("../lib/utils");

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["BOOKINGS"];
  if (!ws) throw new Error("Sheet 'BOOKINGS' not found in workbook");

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
  });

  // Row 2 has headers; data starts at row 3.
  const dataRows = rows.slice(2);
  let inserted = 0;
  let skipped = 0;
  let withDefaults = 0;

  for (const row of dataRows) {
    const guestName = String(row[1] ?? "").trim();
    if (!guestName) continue;

    const unit = normalizeUnit(row[4]);
    const checkIn = parseDate(row[5]);
    const checkOut = parseDate(row[7]) ?? checkIn;
    if (!checkIn || !checkOut) {
      skipped += 1;
      continue;
    }

    const checkInTime = normalizeTime(row[6], DEFAULT_CHECKIN_TIME);
    const checkOutTime = normalizeTime(row[8], DEFAULT_CHECKOUT_TIME);
    const hoursStayed = toNumber(row[9]);

    const totalFee = toNumber(row[11]);
    const dpAmount = toNumber(row[12]);
    const fpAmount = toNumber(row[16]);

    const dpDate = parseDate(row[13]);
    const fpDate = parseDate(row[19]);

    const dpMethod = String(row[14] ?? "").trim() || null;
    const dpReceivedBy = String(row[15] ?? "").trim() || null;
    const fpSplit = splitFpFields(row[17], row[18]);

    const remainingBalance = toNumber(row[20]) || calcRemaining(dpAmount, fpAmount, totalFee);
    const paymentStatus = String(row[21] ?? "").trim() || calcPaymentStatus(dpAmount, fpAmount, totalFee);
    const hasConflict = String(row[23] ?? "").includes("CONFLICT") ? "CONFLICT" : "OK";

    const [existing] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.guestName, guestName),
          eq(bookings.unit, unit),
          eq(bookings.checkIn, checkIn),
          eq(bookings.checkOut, checkOut),
        )
      );

    if (existing) {
      skipped += 1;
      continue;
    }

    const usedDefault =
      !String(row[4] ?? "").trim() ||
      !String(row[6] ?? "").trim() ||
      !String(row[8] ?? "").trim() ||
      !String(row[21] ?? "").trim();

    await db.insert(bookings).values({
      guestName,
      contactNo: normalizePhone(row[3]),
      unit,
      checkIn,
      checkInTime,
      checkOut,
      checkOutTime,
      hoursStayed,
      totalFee,
      dpAmount,
      dpDate,
      dpMethod,
      dpReceivedBy,
      fpAmount,
      fpDate,
      fpMethod: fpSplit.fpMethod,
      fpReceivedBy: fpSplit.fpReceivedBy,
      remainingBalance,
      paymentStatus,
      hasConflict,
    });

    inserted += 1;
    if (usedDefault) withDefaults += 1;
  }

  console.log("\nImport finished");
  console.log(`File: ${filePath}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Inserted with defaults: ${withDefaults}`);
}

run().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
