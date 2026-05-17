import { config } from "dotenv";
import { resolve } from "path";
import { createInterface } from "readline";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { db } from "../lib/db";
import { sql } from "drizzle-orm";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function createManualExpensesTable() {
  console.log("\n🔍 Current DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 50) + "...");
  console.log("\n⚠️  WARNING: This will create the manual_expenses table in the database above.");
  
  const answer = await question("\nIs this the PRODUCTION database? (yes/no): ");
  
  if (answer.toLowerCase() !== "yes") {
    console.log("❌ Aborted. Please update your .env.local with the production DATABASE_URL.");
    process.exit(0);
  }

  console.log("\n🔨 Creating manual_expenses table...");

  try {
    // Check if table already exists
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'manual_expenses'
      ) as table_exists
    `);

    if (tableCheck.rows[0].table_exists) {
      console.log("ℹ️  Table already exists!");
      
      // Show current data
      const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM manual_expenses`);
      console.log(`📊 Current records: ${countResult.rows[0].count}`);
      
      const answer2 = await question("\nDo you want to see the existing records? (yes/no): ");
      if (answer2.toLowerCase() === "yes") {
        const records = await db.execute(sql`SELECT * FROM manual_expenses ORDER BY created_at DESC LIMIT 10`);
        console.log("\n📋 Last 10 records:");
        console.table(records.rows);
      }
    } else {
      // Create the table
      await db.execute(sql`
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
      console.log("✅ manual_expenses table created successfully!");

      // Create index
      await db.execute(sql`
        CREATE INDEX idx_manual_expenses_week_receiver 
        ON manual_expenses(week_start, week_end, receiver)
      `);
      console.log("✅ Index created successfully!");
    }

    // Test insert and delete
    console.log("\n🧪 Testing insert...");
    const testResult = await db.execute(sql`
      INSERT INTO manual_expenses (week_start, week_end, receiver, amount, comment)
      VALUES ('2026-01-01', '2026-01-07', 'TEST', 100, 'Test expense')
      RETURNING *
    `);
    console.log("✅ Test insert successful:", testResult.rows[0]);

    console.log("\n🧹 Cleaning up test data...");
    await db.execute(sql`DELETE FROM manual_expenses WHERE receiver = 'TEST'`);
    console.log("✅ Test data removed");

    console.log("\n✅ All done! The manual_expenses table is ready in production.");
    console.log("\n📝 Next steps:");
    console.log("   1. Go to your live site");
    console.log("   2. Try adding a manual expense");
    console.log("   3. Refresh the page - it should persist now!");

  } catch (error) {
    console.error("\n❌ Error:", error);
    if (error instanceof Error) {
      console.error("Details:", error.message);
      console.error("Stack:", error.stack);
    }
    throw error;
  }
}

createManualExpensesTable()
  .then(() => {
    rl.close();
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    rl.close();
    process.exit(1);
  });
