import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wages } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const wage = await db.select().from(wages).where(eq(wages.id, parseInt(id)));
    if (!wage.length) {
      return NextResponse.json({ error: "Wage record not found" }, { status: 404 });
    }
    return NextResponse.json(wage[0]);
  } catch (e) {
    console.error("[GET /api/wages/[id]]", e);
    return NextResponse.json({ error: "Failed to load wage record" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { employeeName, amount, payDate, period, status, notes, paidDate } = body;

    const payDateObj = payDate ? new Date(payDate) : undefined;
    const paidDateObj = paidDate ? new Date(paidDate) : null;

    const updated = await db
      .update(wages)
      .set({
        employeeName,
        amount: amount !== undefined ? Math.round(amount) : undefined,
        payDate: payDateObj,
        period,
        status,
        notes,
        updatedAt: new Date(),
      })
      .where(eq(wages.id, parseInt(id)))
      .returning();

    if (!updated.length) {
      return NextResponse.json({ error: "Wage record not found" }, { status: 404 });
    }
    return NextResponse.json(updated[0]);
  } catch (e) {
    console.error("[PUT /api/wages/[id]]", e);
    return NextResponse.json({ error: "Failed to update wage record" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await db.delete(wages).where(eq(wages.id, parseInt(id))).returning();
    if (!deleted.length) {
      return NextResponse.json({ error: "Wage record not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/wages/[id]]", e);
    return NextResponse.json({ error: "Failed to delete wage record" }, { status: 500 });
  }
}
