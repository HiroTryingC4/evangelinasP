import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expenses } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");

    let baseQuery = db.select({
      id: expenses.id,
      description: expenses.description,
      amount: expenses.amount,
      expenseDate: expenses.expenseDate,
      dueDate: expenses.dueDate,
      category: expenses.category,
      paymentMethod: expenses.paymentMethod,
      status: expenses.status,
      notes: expenses.notes,
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
    }).from(expenses);

    const allExpenses = await (status
      ? baseQuery.where(eq(expenses.status, status)).orderBy(desc(expenses.expenseDate), desc(expenses.id))
      : baseQuery.orderBy(desc(expenses.expenseDate), desc(expenses.id))
    );

    return NextResponse.json(allExpenses);
  } catch (e) {
    console.error("[GET /api/expenses]", e);
    return NextResponse.json({ error: "Failed to load expenses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description, amount, expenseDate, dueDate, category, paymentMethod, notes } = body;

    if (!description || amount === undefined || !expenseDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const expenseDateObj = new Date(expenseDate);
    const dueDateObj = dueDate ? new Date(dueDate) : null;
    const amountNumber = Number(amount);

    if (Number.isNaN(amountNumber)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const inserted = await db
      .insert(expenses)
      .values({
        description,
        amount: amountNumber.toFixed(2),
        expenseDate: expenseDateObj,
        dueDate: dueDateObj,
        category,
        paymentMethod,
        notes,
        status: "pending",
      })
      .returning();

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (e) {
    console.error("[POST /api/expenses]", e);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
