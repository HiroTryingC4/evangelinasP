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

async function checkCurrentWeek() {
  console.log("\n📋 Checking expenses for week 2026-05-17 to 2026-05-23...\n");
  
  const records = await db.execute(sqlTag`
    SELECT * FROM manual_expenses 
    WHERE week_start = '2026-05-17' AND week_end = '2026-05-23'
    ORDER BY created_at DESC
  `);
  
  console.log(`Found ${records.rows.length} records:\n`);
  
  if (records.rows.length > 0) {
    console.table(records.rows);
    
    console.log("\n🗑️ Do you want to delete these records? They might be duplicates.");
    console.log("If yes, run this command:");
    console.log("\nDELETE FROM manual_expenses WHERE week_start = '2026-05-17' AND week_end = '2026-05-23';\n");
  } else {
    console.log("✅ No records found for this week. The issue might be resolved!\n");
  }
  
  // Show ALL records
  console.log("\n📊 ALL records in database:\n");
  const allRecords = await db.execute(sqlTag`SELECT * FROM manual_expenses ORDER BY created_at DESC`);
  console.table(allRecords.rows);
}

checkCurrentWeek()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
