import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentTransfers, persons } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

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

    return NextResponse.json(transfers);
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
    const { senderId, recipientId, amount, transferDate, reason, paymentMethod, status } = body;

    if (!senderId || !recipientId || !amount || !transferDate) {
      return NextResponse.json(
        { error: "Missing required fields: senderId, recipientId, amount, transferDate" },
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

    const sendP = await db.select().from(persons).where(eq(persons.id, parseInt(senderId)));
    const recP = await db.select().from(persons).where(eq(persons.id, parseInt(recipientId)));

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
        senderId: parseInt(senderId),
        recipientId: parseInt(recipientId),
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

    await db.update(persons).set({ balance: newSenderBal, updatedAt: new Date() }).where(eq(persons.id, parseInt(senderId)));
    await db.update(persons).set({ balance: newRecipBal, updatedAt: new Date() }).where(eq(persons.id, parseInt(recipientId)));

    return NextResponse.json(transfer, { status: 201 });
  } catch (error) {
    console.error("POST /api/payment-transfers:", error);
    return NextResponse.json(
      { error: "Failed to create transfer" },
      { status: 500 }
    );
  }
}
