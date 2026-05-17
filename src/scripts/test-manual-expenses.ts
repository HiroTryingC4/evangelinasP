import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function testManualExpenses() {
  console.log("Testing manual_expenses table...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL ? "✅ Set" : "❌ Not set");

  try {
    // First, ensure the table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS manual_expenses (
        id SERIAL PRIMARY KEY,
        week_start TEXT NOT NULL,
        week_end TEXT NOT NULL,
        receiver TEXT NOT NULL,
        amount INTEGER NOT NULL,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ Table exists or created");

    // Create index
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_manual_expenses_week_receiver 
      ON manual_expenses(week_start, week_end, receiver)
    `);
    console.log("✅ Index exists or created");

    // Check if there are any records
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM manual_expenses`);
    console.log("📊 Total records in table:", result.rows[0]);

    // Try to fetch records for the current week
    const weekStart = "2026-05-17";
    const weekEnd = "2026-05-23";
    const expenses = await db.execute(
      sql`SELECT * FROM manual_expenses WHERE week_start = ${weekStart} AND week_end = ${weekEnd}`
    );
    console.log(`📋 Records for week ${weekStart} to ${weekEnd}:`, expenses.rows);

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

testManualExpenses()
  .then(() => {
    console.log("✅ Test completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
