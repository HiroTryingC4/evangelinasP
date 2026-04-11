import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bills } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query: any = db.select().from(bills);
    if (status) {
      query = query.where(eq(bills.status, status));
    }

    const allBills = await query.orderBy(desc(bills.billDate), desc(bills.id));

    return NextResponse.json(allBills);
  } catch (e) {
    console.error("[GET /api/bills]", e);
    return NextResponse.json({ error: "Failed to load bills" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description, amount, billDate, dueDate, category, notes } = body;

    if (!description || amount === undefined || !billDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const billDateObj = new Date(billDate);
    const dueDateObj = dueDate ? new Date(dueDate) : null;

    const inserted = await db
      .insert(bills)
      .values({
        description,
        amount: Math.round(amount),
        billDate: billDateObj,
        dueDate: dueDateObj,
        category,
        notes,
        status: "pending",
      })
      .returning();

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (e) {
    console.error("[POST /api/bills]", e);
    return NextResponse.json({ error: "Failed to create bill" }, { status: 500 });
  }
}
