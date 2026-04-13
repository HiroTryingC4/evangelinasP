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

async function recalculatePersonBalancesFromTransfers() {
  const [allPeople, allTransfers] = await Promise.all([
    db.select().from(persons),
    db.select().from(paymentTransfers),
  ]);

  const deltaByPersonId = new Map<number, number>();
  for (const person of allPeople) {
    deltaByPersonId.set(person.id, 0);
  }

  for (const transfer of allTransfers) {
    const amount = Number(transfer.amount || 0);
    deltaByPersonId.set(
      transfer.senderId,
      (deltaByPersonId.get(transfer.senderId) || 0) - amount
    );
    deltaByPersonId.set(
      transfer.recipientId,
      (deltaByPersonId.get(transfer.recipientId) || 0) + amount
    );
  }

  for (const person of allPeople) {
    await db
      .update(persons)
      .set({
        balance: (deltaByPersonId.get(person.id) || 0).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(persons.id, person.id));
  }
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
      sourceUnit,
      sourceWeekStart,
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

    const newSenderId = sender
      ? await findOrCreatePersonId(String(sender), "sender")
      : parseInt(String(senderId), 10);
    const newRecipientId = recipient
      ? await findOrCreatePersonId(String(recipient), "recipient")
      : parseInt(String(recipientId), 10);

    if (newSenderId === newRecipientId) {
      return NextResponse.json({ error: "Sender and recipient must be different" }, { status: 400 });
    }

    const newSender = await db.select().from(persons).where(eq(persons.id, newSenderId));
    const newRecipient = await db.select().from(persons).where(eq(persons.id, newRecipientId));

    if (!newSender.length || !newRecipient.length) {
      return NextResponse.json({ error: "Sender or recipient not found" }, { status: 404 });
    }

    const updated = await db
      .update(paymentTransfers)
      .set({
        senderId: newSenderId,
        recipientId: newRecipientId,
        amount: amountStr,
        transferDate: transferDate ? new Date(transferDate) : undefined,
        sourceUnit: sourceUnit !== undefined ? (sourceUnit ? String(sourceUnit) : null) : undefined,
        sourceWeekStart: sourceWeekStart !== undefined ? (sourceWeekStart ? new Date(sourceWeekStart) : null) : undefined,
        reason: reason || undefined,
        paymentMethod: paymentMethod || undefined,
        status: status || undefined,
        updatedAt: new Date(),
      })
      .where(eq(paymentTransfers.id, id))
      .returning();

    await recalculatePersonBalancesFromTransfers();

    return NextResponse.json({
      ...updated[0],
      sender: newSender[0].name,
      recipient: newRecipient[0].name,
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
    const deleted = await db
      .delete(paymentTransfers)
      .where(eq(paymentTransfers.id, id))
      .returning();

    await recalculatePersonBalancesFromTransfers();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/payment-transfers/[id]:", error);
    return NextResponse.json(
      { error: "Failed to delete transfer" },
      { status: 500 }
    );
  }
}
