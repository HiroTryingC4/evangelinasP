import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

let bookingSourceEnsured = false;
let bookingSourceEnsurePromise: Promise<void> | null = null;

export async function ensureBookingSourceColumn() {
  if (bookingSourceEnsured) return;
  if (!bookingSourceEnsurePromise) {
    bookingSourceEnsurePromise = db
      .execute(
        sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_source text NOT NULL DEFAULT 'Direct'`
      )
      .then(() => {
        bookingSourceEnsured = true;
      })
      .finally(() => {
        bookingSourceEnsurePromise = null;
      });
  }

  await bookingSourceEnsurePromise;
}