import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentTransfers, persons } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function findOrCreatePersonId(name: string, type: "sender" | "recipient") {
  const normalized = name.trim().toLowerCase();
  const existing = await db.select().from(persons).where(eq(persons.name, normalized));
  if (existing.length > 0) return existing[0].id;
  const created = await db
    .insert(persons)
    .values({ name: normalized, type, balance: "0.00" })
    .returning();
  return created[0].id;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10);
    const body = await req.json();
    const {
      sender,
      recipient,
      senderId,
      recipientId,
      amount,
      transferDate,
      reason,
      paymentMethod,
      status,
    } = body;

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

    const newSenderId = sender
      ? await findOrCreatePersonId(String(sender), "sender")
      : parseInt(String(senderId), 10);
    const newRecipientId = recipient
      ? await findOrCreatePersonId(String(recipient), "recipient")
      : parseInt(String(recipientId), 10);

    if (newSenderId === newRecipientId) {
      return NextResponse.json({ error: "Sender and recipient must be different" }, { status: 400 });
    }

    const oldSender = await db.select().from(persons).where(eq(persons.id, orig.senderId));
    const oldRecipient = await db.select().from(persons).where(eq(persons.id, orig.recipientId));
    const newSender = await db.select().from(persons).where(eq(persons.id, newSenderId));
    const newRecipient = await db.select().from(persons).where(eq(persons.id, newRecipientId));

    if (!oldSender.length || !oldRecipient.length || !newSender.length || !newRecipient.length) {
      return NextResponse.json({ error: "Sender or recipient not found" }, { status: 404 });
    }

    // Revert old transfer effect.
    await db
      .update(persons)
      .set({ balance: (Number(oldSender[0].balance || 0) + origAmountNum).toFixed(2), updatedAt: new Date() })
      .where(eq(persons.id, orig.senderId));
    await db
      .update(persons)
      .set({ balance: (Number(oldRecipient[0].balance || 0) - origAmountNum).toFixed(2), updatedAt: new Date() })
      .where(eq(persons.id, orig.recipientId));

    // Fetch balances again after revert when sender/recipient are reused.
    const newSenderAfterRevert = await db.select().from(persons).where(eq(persons.id, newSenderId));
    const newRecipientAfterRevert = await db.select().from(persons).where(eq(persons.id, newRecipientId));

    await db
      .update(persons)
      .set({
        balance: (Number(newSenderAfterRevert[0].balance || 0) - amountNumber).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(persons.id, newSenderId));
    await db
      .update(persons)
      .set({
        balance: (Number(newRecipientAfterRevert[0].balance || 0) + amountNumber).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(persons.id, newRecipientId));

    const updated = await db
      .update(paymentTransfers)
      .set({
        senderId: newSenderId,
        recipientId: newRecipientId,
        amount: amountStr,
        transferDate: transferDate ? new Date(transferDate) : undefined,
        reason: reason || undefined,
        paymentMethod: paymentMethod || undefined,
        status: status || undefined,
        updatedAt: new Date(),
      })
      .where(eq(paymentTransfers.id, id))
      .returning();

    return NextResponse.json({
      ...updated[0],
      sender: newSenderAfterRevert[0].name,
      recipient: newRecipientAfterRevert[0].name,
    });
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
