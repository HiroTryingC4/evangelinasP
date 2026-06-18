import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

let bookingSourceEnsured = false;
let bookingSourceEnsurePromise: Promise<void> | null = null;

let manualExpensesEnsured = false;
let manualExpensesEnsurePromise: Promise<void> | null = null;

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

export async function ensureManualExpensesTable() {
  if (manualExpensesEnsured) {
    console.log("✅ manual_expenses table already ensured");
    return;
  }
  if (!manualExpensesEnsurePromise) {
    manualExpensesEnsurePromise = (async () => {
      try {
        console.log("🔨 Creating manual_expenses table if not exists...");
        // Create table if it doesn't exist
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS manual_expenses (
            id SERIAL PRIMARY KEY,
            week_start TEXT NOT NULL,
            week_end TEXT NOT NULL,
            receiver TEXT NOT NULL,
            amount INTEGER NOT NULL,
            comment TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'expense',
            expense_date TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);
        console.log("✅ manual_expenses table created/verified");

        // Add columns if they don't exist
        await db.execute(sql`
          ALTER TABLE manual_expenses 
          ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense'
        `);
        
        await db.execute(sql`
          ALTER TABLE manual_expenses 
          ADD COLUMN IF NOT EXISTS expense_date TEXT
        `);
        console.log("✅ Columns added/verified");

        // Create index for faster queries
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS idx_manual_expenses_week_receiver 
          ON manual_expenses(week_start, week_end, receiver)
        `);
        console.log("✅ Index created/verified");

        manualExpensesEnsured = true;
      } catch (error) {
        console.error("❌ Error ensuring manual_expenses table:", error);
        throw error;
      } finally {
        manualExpensesEnsurePromise = null;
      }
    })();
  }

  await manualExpensesEnsurePromise;
}