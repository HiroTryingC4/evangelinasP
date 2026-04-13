import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentTransfers, persons } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    const body = await req.json();
    const { senderId, recipientId, amount, transferDate, reason, paymentMethod, status } = body;

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

    const amountStr = amountNumber.toFixed(2);

    // Get original transfer to reverse balance changes
    const originalTransfer = await db
      .select()
      .from(paymentTransfers)
      .where(eq(paymentTransfers.id, id));

    if (!originalTransfer.length) {
      return NextResponse.json(
        { error: "Transfer not found" },
        { status: 404 }
      );
    }

    const orig = originalTransfer[0];

    const origAmountNum = Number(orig.amount);

    // Get current sender and recipient balances
    const sendPerson = await db
      .select()
      .from(persons)
      .where(eq(persons.id, parseInt(senderId)));
  
    const recPerson = await db
      .select()
      .from(persons)
      .where(eq(persons.id, parseInt(recipientId)));

    if (!sendPerson.length || !recPerson.length) {
      return NextResponse.json(
        { error: "Sender or recipient not found" },
        { status: 404 }
      );
    }

    const senderBalance = Number(sendPerson[0].balance || 0);
    const recipientBalance = Number(recPerson[0].balance || 0);

    // Reverse original balance changes
    const newSenderBalance = (senderBalance + origAmountNum).toFixed(2);
    const newRecipientBalance = (recipientBalance - origAmountNum).toFixed(2);

    // Apply new balance changes
    const finalSenderBalance = (Number(newSenderBalance) - amountNumber).toFixed(2);
    const finalRecipientBalance = (Number(newRecipientBalance) + amountNumber).toFixed(2);

    await db
      .update(persons)
      .set({
        balance: finalSenderBalance,
      })
      .where(eq(persons.id, parseInt(senderId)));

    await db
      .update(persons)
      .set({
        balance: finalRecipientBalance,
      })
      .where(eq(persons.id, parseInt(recipientId)));

    const updated = await db
      .update(paymentTransfers)
      .set({
        senderId: parseInt(senderId),
        recipientId: parseInt(recipientId),
        amount: amountStr,
        transferDate: transferDate ? new Date(transferDate) : undefined,
        reason: reason || undefined,
        paymentMethod: paymentMethod || undefined,
        status: status || undefined,
        updatedAt: new Date(),
      })
      .where(eq(paymentTransfers.id, id))
      .returning();

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

    // Get transfer to reverse balance changes
    const transfer = await db
      .select()
      .from(paymentTransfers)
      .where(eq(paymentTransfers.id, id));

    if (!transfer.length) {
      return NextResponse.json(
        { error: "Transfer not found" },
        { status: 404 }
      );
    }


    const t = transfer[0];
    const tAmountNum = Number(t.amount);

    // Get persons to reverse their balances
    const senderPerson = await db
      .select()
      .from(persons)
      .where(eq(persons.id, t.senderId));

    const recipPerson = await db
      .select()
      .from(persons)
      .where(eq(persons.id, t.recipientId));

    if (senderPerson.length > 0) {
      const newBalance = (Number(senderPerson[0].balance || 0) + tAmountNum).toFixed(2);
      await db
        .update(persons)
        .set({ balance: newBalance })
        .where(eq(persons.id, t.senderId));
    }

    if (recipPerson.length > 0) {
      const newBalance = (Number(recipPerson[0].balance || 0) - tAmountNum).toFixed(2);
      await db
        .update(persons)
        .set({ balance: newBalance })
        .where(eq(persons.id, t.recipientId));
    }


    const deleted = await db
      .delete(paymentTransfers)
      .where(eq(paymentTransfers.id, id))
      .returning();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/payment-transfers/[id]:", error);
    return NextResponse.json(
      { error: "Failed to delete transfer" },
      { status: 500 }
    );
  }
}
