import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bills } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bill = await db.select().from(bills).where(eq(bills.id, parseInt(id)));
    if (!bill.length) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }
    return NextResponse.json(bill[0]);
  } catch (e) {
    console.error("[GET /api/bills/[id]]", e);
    return NextResponse.json({ error: "Failed to load bill" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { description, amount, billDate, dueDate, status, category, notes, paidDate } = body;

    const billDateObj = billDate ? new Date(billDate) : undefined;
    const dueDateObj = dueDate ? new Date(dueDate) : null;
    const paidDateObj = paidDate ? new Date(paidDate) : null;

    const updated = await db
      .update(bills)
      .set({
        description,
        amount: amount !== undefined ? Math.round(amount) : undefined,
        billDate: billDateObj,
        dueDate: dueDateObj,
        status,
        category,
        notes,
        paidDate: paidDateObj,
        updatedAt: new Date(),
      })
      .where(eq(bills.id, parseInt(id)))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }
    return NextResponse.json(updated[0]);
  } catch (e) {
    console.error("[PUT /api/bills/[id]]", e);
    return NextResponse.json({ error: "Failed to update bill" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await db.delete(bills).where(eq(bills.id, parseInt(id))).returning();
    if (!deleted.length) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/bills/[id]]", e);
    return NextResponse.json({ error: "Failed to delete bill" }, { status: 500 });
  }
}
