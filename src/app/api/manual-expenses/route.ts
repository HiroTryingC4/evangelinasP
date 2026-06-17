import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manualExpenses, expenses, bills } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
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

    // First, get the manual expense details to find matching Finances entry
    const manualExpensesToDelete = await db
      .select()
      .from(manualExpenses)
      .where(eq(manualExpenses.id, Number(id)));

    if (manualExpensesToDelete.length === 0) {
      console.error("❌ Manual expense not found");
      return NextResponse.json(
        { error: "Manual expense not found" },
        { status: 404 }
      );
    }

    const manualExpense = manualExpensesToDelete[0];
    console.log("🔍 Found manual expense:", manualExpense);

    // Delete from manual_expenses table
    const result = await db
      .delete(manualExpenses)
      .where(eq(manualExpenses.id, Number(id)))
      .returning();

    console.log("✅ Deleted from manual_expenses:", result);

    return NextResponse.json({ success: true, deleted: result });
  } catch (error) {
    console.error("❌ Error deleting manual expense:", error);
    return NextResponse.json(
      { error: "Failed to delete manual expense", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// PUT: Update a manual expense by ID
export async function PUT(request: NextRequest) {
  try {
    console.log("✏️ PUT /api/manual-expenses - Ensuring table exists...");
    await ensureManualExpensesTable();
    console.log("✅ Table ensured");
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const body = await request.json();
    const { amount, comment } = body;

    console.log("🔍 Updating expense with ID:", id);

    if (!id) {
      console.error("❌ Missing expense ID");
      return NextResponse.json(
        { error: "Missing expense ID" },
        { status: 400 }
      );
    }

    if (amount === undefined || !comment) {
      console.error("❌ Missing required fields:", { amount, comment });
      return NextResponse.json(
        { error: "Missing required fields: amount, comment" },
        { status: 400 }
      );
    }

    // First, get the old manual expense to find the old Finances entry
    const oldManualExpenses = await db
      .select()
      .from(manualExpenses)
      .where(eq(manualExpenses.id, Number(id)));

    if (oldManualExpenses.length === 0) {
      console.error("❌ Expense not found with ID:", id);
      return NextResponse.json(
        { error: "Expense not found" },
        { status: 404 }
      );
    }

    const oldManualExpense = oldManualExpenses[0];

    // Update the manual_expenses table
    const result = await db
      .update(manualExpenses)
      .set({
        amount: Number(amount),
        comment: comment.trim(),
      })
      .where(eq(manualExpenses.id, Number(id)))
      .returning();

    console.log("✅ Updated manual expense:", result[0]);

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("❌ Error updating manual expense:", error);
    return NextResponse.json(
      { error: "Failed to update manual expense", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
