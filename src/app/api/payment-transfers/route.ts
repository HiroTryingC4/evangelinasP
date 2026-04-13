import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentTransfers } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const scope = searchParams.get("scope") || "all";
    const recipient = searchParams.get("recipient");

    let query = db.select().from(paymentTransfers);

    if (recipient) {
      query = query.where(eq(paymentTransfers.recipient, recipient)) as any;
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
    const { recipient, amount, transferDate, reason, paymentMethod, status } = body;

    // Validation
    if (!recipient || !amount || !transferDate) {
      return NextResponse.json(
        { error: "Missing required fields: recipient, amount, transferDate" },
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

    const newTransfer = await db
      .insert(paymentTransfers)
      .values({
        recipient,
        amount: amountNumber.toFixed(2),
        transferDate: new Date(transferDate),
        reason: reason || null,
        paymentMethod: paymentMethod || null,
        status: status || "transferred",
      })
      .returning();

    return NextResponse.json(newTransfer[0], { status: 201 });
  } catch (error) {
    console.error("POST /api/payment-transfers:", error);
    return NextResponse.json(
      { error: "Failed to create transfer" },
      { status: 500 }
    );
  }
}
