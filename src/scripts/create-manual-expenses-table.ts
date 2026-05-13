import { config } from "dotenv";

// Load environment variables FIRST before any other imports
config({ path: ".env.local" });

import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function createManualExpensesTable() {
  console.log("Creating manual_expenses table...");

  try {
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

    console.log("✅ manual_expenses table created successfully");

    // Create an index for faster queries
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_manual_expenses_week_receiver 
      ON manual_expenses(week_start, week_end, receiver)
    `);

    console.log("✅ Index created successfully");
  } catch (error) {
    console.error("❌ Error creating table:", error);
    throw error;
  }
}

createManualExpensesTable()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });
