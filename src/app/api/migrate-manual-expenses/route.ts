import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manualExpenses, expenses } from "@/lib/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET endpoint to run the migration
export async function GET() {
  try {
    console.log("🔄 Starting migration of manual expenses to Finances...");

    // Fetch all manual expenses
    const allManualExpenses = await db.select({
      id: manualExpenses.id,
      weekStart: manualExpenses.weekStart,
      weekEnd: manualExpenses.weekEnd,
      receiver: manualExpenses.receiver,
      amount: manualExpenses.amount,
      comment: manualExpenses.comment,
      type: manualExpenses.type,
      expenseDate: manualExpenses.expenseDate,
      createdAt: manualExpenses.createdAt,
    }).from(manualExpenses);
    
    console.log(`📊 Found ${allManualExpenses.length} manual expenses to migrate`);

    if (allManualExpenses.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No manual expenses to migrate",
        migrated: 0,
        skipped: 0,
        total: 0,
      });
    }

    let migrated = 0;
    let skipped = 0;
    const details: string[] = [];

    for (const manualExpense of allManualExpenses) {
      try {
        const expenseDescription = `Manual Weekly Expense: ${manualExpense.comment}`;
        const expenseAmount = Number(manualExpense.amount);
        const expenseDate = new Date(manualExpense.weekStart);

        // Check if this expense already exists in finances
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
          details.push(`⏭️ Skipped: "${manualExpense.comment}" (already exists)`);
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

        details.push(`✅ Migrated: "${manualExpense.comment}" - ₱${expenseAmount} (Week: ${manualExpense.weekStart})`);
        migrated++;
      } catch (error) {
        const errorMsg = `❌ Failed to migrate expense "${manualExpense.comment}": ${error}`;
        details.push(errorMsg);
        console.error(errorMsg);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Migration completed",
      migrated,
      skipped,
      total: allManualExpenses.length,
      details,
    });
  } catch (error) {
    console.error("❌ Migration failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Migration failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
