import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manualExpenses, expenses } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { ensureManualExpensesTable } from "@/lib/db-health";

export const dynamic = "force-dynamic";

// GET: Fetch manual expenses for a specific week and receiver
export async function GET(request: NextRequest) {
  try {
    await ensureManualExpensesTable();
    
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart");
    const weekEnd = searchParams.get("weekEnd");
    const receiver = searchParams.get("receiver");

    if (!weekStart || !weekEnd || !receiver) {
      return NextResponse.json(
        { error: "Missing required parameters: weekStart, weekEnd, receiver" },
        { status: 400 }
      );
    }

    const expenses = await db
      .select()
      .from(manualExpenses)
      .where(
        and(
          eq(manualExpenses.weekStart, weekStart),
          eq(manualExpenses.weekEnd, weekEnd),
          eq(manualExpenses.receiver, receiver)
        )
      );

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("Error fetching manual expenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch manual expenses" },
      { status: 500 }
    );
  }
}

// POST: Create a new manual expense
export async function POST(request: NextRequest) {
  try {
    console.log("📝 POST /api/manual-expenses - Ensuring table exists...");
    await ensureManualExpensesTable();
    console.log("✅ Table ensured");
    
    const body = await request.json();
    console.log("📦 Received body:", body);
    const { weekStart, weekEnd, receiver, amount, comment } = body;

    if (!weekStart || !weekEnd || !receiver || !amount || !comment) {
      console.error("❌ Missing required fields:", { weekStart, weekEnd, receiver, amount, comment });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("💾 Inserting manual expense:", { weekStart, weekEnd, receiver, amount: Number(amount), comment });
    const [newExpense] = await db
      .insert(manualExpenses)
      .values({
        weekStart,
        weekEnd,
        receiver,
        amount: Number(amount),
        comment,
      })
      .returning();

    console.log("✅ Manual expense created:", newExpense);

    // Also create a corresponding expense entry in the Finances system
    try {
      console.log("💰 Creating corresponding Finances expense...");
      const expenseDescription = `Manual Weekly Expense: ${comment}`;
      const expenseAmount = Number(amount);
      const expenseDate = new Date(weekStart); // Use week start date as expense date

      const [financeExpense] = await db
        .insert(expenses)
        .values({
          description: expenseDescription,
          amount: expenseAmount.toFixed(2),
          expenseDate: expenseDate,
          dueDate: null, // Leave blank as requested
          category: null, // Leave blank as requested
          paymentMethod: null, // Leave blank as requested
          notes: null, // Leave blank as requested
          status: "paid",
        })
        .returning();

      console.log("✅ Finances expense created:", financeExpense);
    } catch (financeError) {
      console.error("⚠️ Failed to create Finances expense (manual expense still created):", financeError);
      // Don't fail the whole request if finance expense creation fails
    }

    return NextResponse.json(newExpense, { status: 201 });
  } catch (error) {
    console.error("❌ Error creating manual expense:", error);
    return NextResponse.json(
      { error: "Failed to create manual expense", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// DELETE: Remove a manual expense by ID
export async function DELETE(request: NextRequest) {
  try {
    console.log("🗑️ DELETE /api/manual-expenses - Ensuring table exists...");
    await ensureManualExpensesTable();
    console.log("✅ Table ensured");
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    console.log("🔍 Deleting expense with ID:", id);

    if (!id) {
      console.error("❌ Missing expense ID");
      return NextResponse.json(
        { error: "Missing expense ID" },
        { status: 400 }
      );
    }

    const result = await db
      .delete(manualExpenses)
      .where(eq(manualExpenses.id, Number(id)))
      .returning();

    console.log("✅ Deleted expense:", result);

    return NextResponse.json({ success: true, deleted: result });
  } catch (error) {
    console.error("❌ Error deleting manual expense:", error);
    return NextResponse.json(
      { error: "Failed to delete manual expense", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
