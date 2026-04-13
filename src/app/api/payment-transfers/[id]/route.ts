import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings, paymentTransfers, persons, receiverPersons } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";

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

type ReceiverAccount = {
  name: string;
  role: "employee" | "host";
  availableBalance: number;
};

function normalizeName(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

async function buildReceiverAccountMap(excludeTransferId?: number) {
  const [configuredReceivers, allBookings, allTransfers, allPersons] = await Promise.all([
    db
      .select({ name: receiverPersons.name, role: receiverPersons.role })
      .from(receiverPersons)
      .orderBy(asc(receiverPersons.sortOrder), asc(receiverPersons.id)),
    db
      .select({
        dpAmount: bookings.dpAmount,
        fpAmount: bookings.fpAmount,
        dpReceivedBy: bookings.dpReceivedBy,
        fpReceivedBy: bookings.fpReceivedBy,
      })
      .from(bookings),
    db.select().from(paymentTransfers),
    db.select().from(persons),
  ]);

  const personMap = new Map(allPersons.map((p) => [p.id, normalizeName(p.name)]));
  const accountMap = new Map<string, ReceiverAccount>();

  for (const receiver of configuredReceivers) {
    const key = normalizeName(receiver.name);
    if (!key || accountMap.has(key)) continue;
    accountMap.set(key, {
      name: receiver.name,
      role: receiver.role === "host" ? "host" : "employee",
      availableBalance: 0,
    });
  }

  const addBookingReceipt = (name: string | null, amount: number) => {
    const key = normalizeName(name);
    if (!key || amount <= 0) return;
    const account = accountMap.get(key);
    if (!account) return;
    account.availableBalance += amount;
  };

  for (const booking of allBookings) {
    addBookingReceipt(booking.dpReceivedBy, Number(booking.dpAmount ?? 0));
    addBookingReceipt(booking.fpReceivedBy, Number(booking.fpAmount ?? 0));
  }

  for (const transfer of allTransfers) {
    if (excludeTransferId && transfer.id === excludeTransferId) continue;
    const amount = Number(transfer.amount ?? 0);
    if (amount <= 0) continue;

    const senderKey = personMap.get(transfer.senderId) ?? "";
    const recipientKey = personMap.get(transfer.recipientId) ?? "";

    const senderAccount = accountMap.get(senderKey);
    if (senderAccount) senderAccount.availableBalance -= amount;

    const recipientAccount = accountMap.get(recipientKey);
    if (recipientAccount) recipientAccount.availableBalance += amount;
  }

  return new Map(
    Array.from(accountMap.values()).map((account) => [
      normalizeName(account.name),
      {
        ...account,
        availableBalance: Number(account.availableBalance.toFixed(2)),
      },
    ])
  );
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

    const senderName = String(sender ?? "").trim();
    const accountMap = await buildReceiverAccountMap(id);
    const senderAccount = accountMap.get(normalizeName(senderName));
    if (!senderAccount) {
      return NextResponse.json(
        { error: "Sender is not configured in Settings > Receiver Persons" },
        { status: 400 }
      );
    }

    if (amountNumber > senderAccount.availableBalance) {
      return NextResponse.json(
        {
          error: `Insufficient balance. ${senderName} has ${senderAccount.availableBalance.toFixed(2)} available.`,
        },
        { status: 400 }
      );
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
