import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentTransfers } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    const body = await req.json();
    const { recipient, amount, transferDate, reason, paymentMethod, status } = body;

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid transfer ID" },
        { status: 400 }
      );
    }

    const amountNumber = Number(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    const updated = await db
      .update(paymentTransfers)
      .set({
        recipient: recipient || undefined,
        amount: amountNumber.toFixed(2),
        transferDate: transferDate ? new Date(transferDate) : undefined,
        reason: reason || undefined,
        paymentMethod: paymentMethod || undefined,
        status: status || undefined,
        updatedAt: new Date(),
      })
      .where(eq(paymentTransfers.id, id))
      .returning();

    if (!updated.length) {
      return NextResponse.json(
        { error: "Transfer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error("PUT /api/payment-transfers/[id]:", error);
    return NextResponse.json(
      { error: "Failed to update transfer" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid transfer ID" },
        { status: 400 }
      );
    }

    const deleted = await db
      .delete(paymentTransfers)
      .where(eq(paymentTransfers.id, id))
      .returning();

    if (!deleted.length) {
      return NextResponse.json(
        { error: "Transfer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/payment-transfers/[id]:", error);
    return NextResponse.json(
      { error: "Failed to delete transfer" },
      { status: 500 }
    );
  }
}
