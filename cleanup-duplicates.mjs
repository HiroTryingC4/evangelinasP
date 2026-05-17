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

async function cleanup() {
  console.log("\n🧹 Checking for issues with manual_expenses...\n");
  
  // Get all records for current week
  const records = await db.execute(sqlTag`
    SELECT * FROM manual_expenses 
    WHERE week_start = '2026-05-17' AND week_end = '2026-05-23'
    ORDER BY id DESC
  `);
  
  console.log(`Found ${records.rows.length} records for current week:\n`);
  console.table(records.rows);
  
  // Try to delete ID 29 specifically
  console.log("\n🗑️ Attempting to delete ID 29...");
  const deleteResult = await db.execute(sqlTag`
    DELETE FROM manual_expenses WHERE id = 29 RETURNING *
  `);
  
  if (deleteResult.rows.length > 0) {
    console.log("✅ Deleted:", deleteResult.rows[0]);
  } else {
    console.log("❌ No record with ID 29 found");
  }
  
  // Check again
  const afterDelete = await db.execute(sqlTag`
    SELECT * FROM manual_expenses 
    WHERE week_start = '2026-05-17' AND week_end = '2026-05-23'
    ORDER BY id DESC
  `);
  
  console.log(`\n📊 After deletion: ${afterDelete.rows.length} records remain:\n`);
  console.table(afterDelete.rows);
}

cleanup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
