import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { incomes } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const income = await db.select().from(incomes).where(eq(incomes.id, parseInt(id)));
    if (!income.length) {
      return NextResponse.json({ error: "Income not found" }, { status: 404 });
    }
    return NextResponse.json(income[0]);
  } catch (e) {
    console.error("[GET /api/income/[id]]", e);
    return NextResponse.json({ error: "Failed to load income" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { description, source, amount, incomeDate, paymentMethod, status, notes } = body;

    const incomeDateObj = incomeDate ? new Date(incomeDate) : undefined;
    const amountNumber = amount !== undefined ? Number(amount) : undefined;

    if (amount !== undefined && Number.isNaN(amountNumber)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const updated = await db
      .update(incomes)
      .set({
        description,
        source,
        amount: amountNumber,
        incomeDate: incomeDateObj,
        paymentMethod,
        status,
        notes,
        updatedAt: new Date(),
      })
      .where(eq(incomes.id, parseInt(id)))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: "Income not found" }, { status: 404 });
    }
    return NextResponse.json(updated[0]);
  } catch (e) {
    console.error("[PUT /api/income/[id]]", e);
    return NextResponse.json({ error: "Failed to update income" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await db.delete(incomes).where(eq(incomes.id, parseInt(id))).returning();
    if (!deleted.length) {
      return NextResponse.json({ error: "Income not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/income/[id]]", e);
    return NextResponse.json({ error: "Failed to delete income" }, { status: 500 });
  }
}
