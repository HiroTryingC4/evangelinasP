import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, ".env.local") });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql as sqlTag } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function checkExpenses() {
  console.log("\n🔍 Checking manual_expenses table...\n");

  try {
    // Get all expenses
    const all = await db.execute(sqlTag`
      SELECT * FROM manual_expenses 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    console.log(`📊 Last 10 expenses in database:\n`);
    console.table(all.rows);

    // Get expenses for May 17-23
    const week = await db.execute(sqlTag`
      SELECT * FROM manual_expenses 
      WHERE week_start = '2026-05-17' AND week_end = '2026-05-23'
      ORDER BY created_at DESC
    `);

    console.log(`\n📋 Expenses for May 17-23, 2026: ${week.rows.length}\n`);
    if (week.rows.length > 0) {
      console.table(week.rows);
    } else {
      console.log("   (none found)");
    }

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

checkExpenses()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
