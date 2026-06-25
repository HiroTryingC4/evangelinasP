import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manualExpenses, expenses, bills, wages } from "@/lib/schema";
import { eq, and, like } from "drizzle-orm";
import { ensureManualExpensesTable } from "@/lib/db-health";

export const dynamic = "force-dynamic";

function buildManualSyncMarker(id: number, receiver: string, weekStart: string, weekEnd: string) {
  return `source-report-manual:${id}|receiver:${receiver}|week:${weekStart}:${weekEnd}`;
}

async function deleteLinkedFinanceEntry(manualExpenseId: number, receiver: string, weekStart: string, weekEnd: string) {
  const marker = buildManualSyncMarker(manualExpenseId, receiver, weekStart, weekEnd);

  const billMatches = await db
    .select({ id: bills.id })
    .from(bills)
    .where(like(bills.notes ?? "", `%${marker}%`));

  if (billMatches.length > 0) {
    await db.delete(bills).where(eq(bills.id, billMatches[0].id));
  }

  const wageMatches = await db
    .select({ id: wages.id })
    .from(wages)
    .where(like(wages.notes ?? "", `%${marker}%`));

  if (wageMatches.length > 0) {
    await db.delete(wages).where(eq(wages.id, wageMatches[0].id));
  }

  const expenseMatches = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(like(expenses.notes ?? "", `%${marker}%`));

  if (expenseMatches.length > 0) {
    await db.delete(expenses).where(eq(expenses.id, expenseMatches[0].id));
  }
}

async function upsertLinkedFinanceEntry(manualExpense: {
  id: number;
  receiver: string;
  amount: number;
  comment: string;
  type: string | null;
  expenseDate?: string | null;
  weekStart: string;
  weekEnd: string;
}) {
  const marker = buildManualSyncMarker(manualExpense.id, manualExpense.receiver, manualExpense.weekStart, manualExpense.weekEnd);
  const entryDate = manualExpense.expenseDate || manualExpense.weekStart;
  const entryDateValue = new Date(`${entryDate}T12:00:00`);
  const notes = `${marker} | source report manual entry`;

  if (manualExpense.type === "bill") {
    const existing = await db
      .select({ id: bills.id })
      .from(bills)
      .where(like(bills.notes ?? "", `%${marker}%`));

    const payload = {
      description: manualExpense.comment.trim(),
      amount: Math.round(Number(manualExpense.amount)),
      billDate: entryDateValue,
      dueDate: entryDateValue,
      paymentMethod: "manual",
      category: "source-report",
      notes,
      status: "pending" as const,
    };

    if (existing.length > 0) {
      await db.update(bills).set(payload).where(eq(bills.id, existing[0].id));
    } else {
      await db.insert(bills).values(payload);
    }
    return;
  }

  if (manualExpense.type === "wage") {
    const existing = await db
      .select({ id: wages.id })
      .from(wages)
      .where(like(wages.notes ?? "", `%${marker}%`));

    const payload = {
      employeeName: manualExpense.comment.trim(),
      amount: Math.round(Number(manualExpense.amount)),
      payDate: entryDateValue,
      dueDate: entryDateValue,
      paymentMethod: "manual",
      notes,
      status: "pending" as const,
    };

    if (existing.length > 0) {
      await db.update(wages).set(payload).where(eq(wages.id, existing[0].id));
    } else {
      await db.insert(wages).values(payload);
    }
    return;
  }

  const existing = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(like(expenses.notes ?? "", `%${marker}%`));

  const payload = {
    description: manualExpense.comment.trim(),
    amount: Number(manualExpense.amount).toFixed(2),
    expenseDate: entryDateValue,
    dueDate: entryDateValue,
    category: "source-report",
    paymentMethod: "manual",
    notes,
    status: "pending" as const,
  };

  if (existing.length > 0) {
    await db.update(expenses).set(payload).where(eq(expenses.id, existing[0].id));
  } else {
    await db.insert(expenses).values(payload);
  }
}

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

    const manualExpensesResult = await db
      .select({
        id: manualExpenses.id,
        weekStart: manualExpenses.weekStart,
        weekEnd: manualExpenses.weekEnd,
        receiver: manualExpenses.receiver,
        amount: manualExpenses.amount,
        comment: manualExpenses.comment,
        type: manualExpenses.type,
        expenseDate: manualExpenses.expenseDate,
        createdAt: manualExpenses.createdAt,
      })
      .from(manualExpenses)
      .where(
        and(
          eq(manualExpenses.weekStart, weekStart),
          eq(manualExpenses.weekEnd, weekEnd),
          eq(manualExpenses.receiver, receiver)
        )
      );

    return NextResponse.json(manualExpensesResult);
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
    const { weekStart, weekEnd, receiver, amount, comment, type = "expense", expenseDate } = body;

    if (!weekStart || !weekEnd || !receiver || !amount || !comment) {
      console.error("❌ Missing required fields:", { weekStart, weekEnd, receiver, amount, comment });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("💾 Inserting manual expense:", { weekStart, weekEnd, receiver, amount: Number(amount), comment, type, expenseDate });
    const [newExpense] = await db
      .insert(manualExpenses)
      .values({
        weekStart,
        weekEnd,
        receiver,
        amount: Number(amount),
        comment,
        type: type || "expense",
        expenseDate: expenseDate || weekStart,
      })
      .returning();

    console.log("✅ Manual expense created:", newExpense);

    await upsertLinkedFinanceEntry({
      id: newExpense.id,
      receiver,
      amount: Number(amount),
      comment,
      type: type || "expense",
      expenseDate: expenseDate || weekStart,
      weekStart,
      weekEnd,
    });

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
      .select({
        id: manualExpenses.id,
        weekStart: manualExpenses.weekStart,
        weekEnd: manualExpenses.weekEnd,
        receiver: manualExpenses.receiver,
        amount: manualExpenses.amount,
        comment: manualExpenses.comment,
        type: manualExpenses.type,
        expenseDate: manualExpenses.expenseDate,
        createdAt: manualExpenses.createdAt,
      })
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

    await deleteLinkedFinanceEntry(
      manualExpense.id,
      manualExpense.receiver,
      manualExpense.weekStart,
      manualExpense.weekEnd
    );

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
    const { amount, comment, type, expenseDate } = body;

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
      .select({
        id: manualExpenses.id,
        weekStart: manualExpenses.weekStart,
        weekEnd: manualExpenses.weekEnd,
        receiver: manualExpenses.receiver,
        amount: manualExpenses.amount,
        comment: manualExpenses.comment,
        type: manualExpenses.type,
        expenseDate: manualExpenses.expenseDate,
        createdAt: manualExpenses.createdAt,
      })
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

    await deleteLinkedFinanceEntry(
      oldManualExpense.id,
      oldManualExpense.receiver,
      oldManualExpense.weekStart,
      oldManualExpense.weekEnd
    );

    // Update the manual_expenses table
    const result = await db
      .update(manualExpenses)
      .set({
        amount: Number(amount),
        comment: comment.trim(),
        type: type || oldManualExpense.type || "expense",
        expenseDate: expenseDate || oldManualExpense.expenseDate,
      })
      .where(eq(manualExpenses.id, Number(id)))
      .returning();

    console.log("✅ Updated manual expense:", result[0]);

    await upsertLinkedFinanceEntry({
      id: result[0].id,
      receiver: oldManualExpense.receiver,
      amount: Number(amount),
      comment,
      type: type || oldManualExpense.type || "expense",
      expenseDate: expenseDate || oldManualExpense.expenseDate,
      weekStart: oldManualExpense.weekStart,
      weekEnd: oldManualExpense.weekEnd,
    });

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("❌ Error updating manual expense:", error);
    return NextResponse.json(
      { error: "Failed to update manual expense", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
