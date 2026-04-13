import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentTransfers, persons } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const recipientId = searchParams.get("recipientId");
    const senderId = searchParams.get("senderId");

    let query = db.select().from(paymentTransfers);

    if (recipientId) {
      query = query.where(eq(paymentTransfers.recipientId, parseInt(recipientId))) as any;
    }

    if (senderId) {
      query = query.where(eq(paymentTransfers.senderId, parseInt(senderId))) as any;
    }

    const transfers = await query.orderBy(desc(paymentTransfers.transferDate));
    const allPersons = await db.select().from(persons);
    const personMap = new Map(allPersons.map((p) => [p.id, p.name]));

    return NextResponse.json(
      transfers.map((t) => ({
        ...t,
        sender: personMap.get(t.senderId) ?? "",
        recipient: personMap.get(t.recipientId) ?? "",
      }))
    );
  } catch (error) {
    console.error("GET /api/payment-transfers:", error);
    return NextResponse.json(
      { error: "Failed to fetch transfers" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
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

    const senderName = String(sender ?? "").trim();
    const recipientName = String(recipient ?? "").trim();

    if ((!senderName && !senderId) || (!recipientName && !recipientId) || !amount || !transferDate) {
      return NextResponse.json(
        { error: "Missing required fields: sender, recipient, amount, transferDate" },
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

    const resolvedSenderId = senderName
      ? await findOrCreatePersonId(senderName, "sender")
      : parseInt(String(senderId), 10);
    const resolvedRecipientId = recipientName
      ? await findOrCreatePersonId(recipientName, "recipient")
      : parseInt(String(recipientId), 10);

    if (resolvedSenderId === resolvedRecipientId) {
      return NextResponse.json(
        { error: "Sender and recipient must be different" },
        { status: 400 }
      );
    }

    const sendP = await db.select().from(persons).where(eq(persons.id, resolvedSenderId));
    const recP = await db.select().from(persons).where(eq(persons.id, resolvedRecipientId));

    if (!sendP.length || !recP.length) {
      return NextResponse.json(
        { error: "Sender or recipient not found" },
        { status: 404 }
      );
    }

    const senderBal = Number(sendP[0].balance || 0);
    const recipBal = Number(recP[0].balance || 0);

    const newTransfer = await db
      .insert(paymentTransfers)
      .values({
        senderId: resolvedSenderId,
        recipientId: resolvedRecipientId,
        amount: amountStr,
        transferDate: new Date(transferDate),
        reason: reason || null,
        paymentMethod: paymentMethod || null,
        status: status || "transferred",
      })
      .returning();

    const transfer = newTransfer[0];

    const newSenderBal = (senderBal - amountNumber).toFixed(2);
    const newRecipBal = (recipBal + amountNumber).toFixed(2);

    await db.update(persons).set({ balance: newSenderBal, updatedAt: new Date() }).where(eq(persons.id, resolvedSenderId));
    await db.update(persons).set({ balance: newRecipBal, updatedAt: new Date() }).where(eq(persons.id, resolvedRecipientId));

    return NextResponse.json(
      {
        ...transfer,
        sender: sendP[0].name,
        recipient: recP[0].name,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/payment-transfers:", error);
    return NextResponse.json(
      { error: "Failed to create transfer" },
      { status: 500 }
    );
  }
}
