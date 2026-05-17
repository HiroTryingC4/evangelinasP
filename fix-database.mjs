import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
config({ path: resolve(__dirname, ".env.local") });

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in .env.local");
  process.exit(1);
}

console.log("\n🔧 Fixing manual_expenses table in production...\n");
console.log("📍 Database:", process.env.DATABASE_URL.substring(0, 60) + "...\n");

// Import neon and drizzle
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql as sqlTag } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function fixProduction() {
  try {
    // Check if table exists
    console.log("1️⃣ Checking if table exists...");
    const tableCheck = await db.execute(sqlTag`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'manual_expenses'
      ) as table_exists
    `);

    const tableExists = tableCheck.rows[0]?.table_exists;
    
    if (tableExists) {
      console.log("✅ Table already exists!\n");
      
      // Show current data
      const countResult = await db.execute(sqlTag`SELECT COUNT(*) as count FROM manual_expenses`);
      console.log(`📊 Current records in table: ${countResult.rows[0].count}\n`);
      
      // Show sample data
      const records = await db.execute(sqlTag`SELECT * FROM manual_expenses ORDER BY created_at DESC LIMIT 5`);
      if (records.rows.length > 0) {
        console.log("📋 Sample records:");
        console.table(records.rows);
      } else {
        console.log("📋 No records in table yet\n");
      }
      
    } else {
      console.log("❌ Table does not exist. Creating it now...\n");
      
      // Create the table
      console.log("2️⃣ Creating manual_expenses table...");
      await db.execute(sqlTag`
        CREATE TABLE manual_expenses (
          id SERIAL PRIMARY KEY,
          week_start TEXT NOT NULL,
          week_end TEXT NOT NULL,
          receiver TEXT NOT NULL,
          amount INTEGER NOT NULL,
          comment TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log("✅ Table created!\n");

      // Create index
      console.log("3️⃣ Creating index...");
      await db.execute(sqlTag`
        CREATE INDEX idx_manual_expenses_week_receiver 
        ON manual_expenses(week_start, week_end, receiver)
      `);
      console.log("✅ Index created!\n");
    }

    // Test insert
    console.log("4️⃣ Testing insert...");
    const testResult = await db.execute(sqlTag`
      INSERT INTO manual_expenses (week_start, week_end, receiver, amount, comment)
      VALUES ('2026-01-01', '2026-01-07', 'TEST', 999, 'Test from fix script')
      RETURNING *
    `);
    console.log("✅ Test insert successful!");
    console.log("   Inserted:", testResult.rows[0]);
    console.log("");

    // Test delete
    console.log("5️⃣ Testing delete...");
    const deleteResult = await db.execute(sqlTag`
      DELETE FROM manual_expenses WHERE receiver = 'TEST' RETURNING *
    `);
    console.log("✅ Test delete successful!");
    console.log("   Deleted:", deleteResult.rows[0]);
    console.log("");

    console.log("🎉 SUCCESS! Everything is working!\n");
    console.log("📝 What this means:");
    console.log("   ✅ Table exists in production database");
    console.log("   ✅ Can insert records");
    console.log("   ✅ Can delete records");
    console.log("   ✅ Your live site should now work correctly!\n");
    console.log("🌐 Go to your live site and try:");
    console.log("   1. Add a manual expense");
    console.log("   2. Refresh - it should stay");
    console.log("   3. Click Remove - it should delete");
    console.log("   4. Refresh - it should stay deleted\n");

  } catch (error) {
    console.error("\n❌ ERROR:", error);
    if (error instanceof Error) {
      console.error("Message:", error.message);
    }
    throw error;
  }
}

fixProduction()
  .then(() => {
    console.log("✅ Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
