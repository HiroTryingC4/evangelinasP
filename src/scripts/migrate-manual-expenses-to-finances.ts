import { db } from "@/lib/db";
import { manualExpenses, expenses } from "@/lib/schema";
import { and, eq } from "drizzle-orm";

async function migrateManualExpensesToFinances() {
  console.log("🔄 Starting migration of manual expenses to Finances...\n");

  try {
    // Fetch all manual expenses
    const allManualExpenses = await db.select().from(manualExpenses);
    
    console.log(`📊 Found ${allManualExpenses.length} manual expenses to migrate\n`);

    if (allManualExpenses.length === 0) {
      console.log("✅ No manual expenses to migrate");
      return;
    }

    let migrated = 0;
    let skipped = 0;

    for (const manualExpense of allManualExpenses) {
      try {
        const expenseDescription = `Manual Weekly Expense: ${manualExpense.comment}`;
        const expenseAmount = Number(manualExpense.amount);
        const expenseDate = new Date(manualExpense.weekStart);

        // Check if this expense already exists in finances
        // (to avoid duplicates if script is run multiple times)
        const existing = await db
          .select()
          .from(expenses)
          .where(
            and(
              eq(expenses.description, expenseDescription),
              eq(expenses.amount, expenseAmount.toFixed(2))
            )
          );

        if (existing.length > 0) {
          console.log(`⏭️  Skipped: "${manualExpense.comment}" (already exists)`);
          skipped++;
          continue;
        }

        // Insert into expenses table
        await db.insert(expenses).values({
          description: expenseDescription,
          amount: expenseAmount.toFixed(2),
          expenseDate: expenseDate,
          dueDate: null,
          category: null,
          paymentMethod: null,
          notes: null,
          status: "pending",
        });

        console.log(`✅ Migrated: "${manualExpense.comment}" - ₱${expenseAmount} (Week: ${manualExpense.weekStart})`);
        migrated++;
      } catch (error) {
        console.error(`❌ Failed to migrate expense "${manualExpense.comment}":`, error);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(`✅ Migration complete!`);
    console.log(`   Migrated: ${migrated} expenses`);
    console.log(`   Skipped: ${skipped} expenses (already existed)`);
    console.log(`   Total: ${allManualExpenses.length} manual expenses`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

migrateManualExpensesToFinances()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
