import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expenses } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query: any = db.select().from(expenses);
    if (status) {
      query = query.where(eq(expenses.status, status));
    }

    const allExpenses = await query.orderBy(desc(expenses.expenseDate), desc(expenses.id));

    return NextResponse.json(allExpenses);
  } catch (e) {
    console.error("[GET /api/expenses]", e);
    return NextResponse.json({ error: "Failed to load expenses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description, amount, expenseDate, category, paymentMethod, notes } = body;

    if (!description || amount === undefined || !expenseDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const expenseDateObj = new Date(expenseDate);

    const inserted = await db
      .insert(expenses)
      .values({
        description,
        amount: Math.round(amount),
        expenseDate: expenseDateObj,
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
