import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expenses } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const expense = await db.select().from(expenses).where(eq(expenses.id, parseInt(id)));
    if (!expense.length) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
    return NextResponse.json(expense[0]);
  } catch (e) {
    console.error("[GET /api/expenses/[id]]", e);
    return NextResponse.json({ error: "Failed to load expense" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { description, amount, expenseDate, dueDate, category, paymentMethod, status, notes } = body;

    const expenseDateObj = expenseDate ? new Date(expenseDate) : undefined;
    const dueDateObj = dueDate ? new Date(dueDate) : null;

    const updated = await db
      .update(expenses)
      .set({
        description,
        amount: amount !== undefined ? Math.round(amount) : undefined,
        expenseDate: expenseDateObj,
        dueDate: dueDateObj,
        category,
        paymentMethod,
        status,
        notes,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, parseInt(id)))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
    return NextResponse.json(updated[0]);
  } catch (e) {
    console.error("[PUT /api/expenses/[id]]", e);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await db.delete(expenses).where(eq(expenses.id, parseInt(id))).returning();
    if (!deleted.length) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/expenses/[id]]", e);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
