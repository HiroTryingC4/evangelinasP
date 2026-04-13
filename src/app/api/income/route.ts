import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { incomes } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");

    let query: any = db.select().from(incomes);
    if (status) {
      query = query.where(eq(incomes.status, status));
    }

    const allIncome = await query.orderBy(desc(incomes.incomeDate), desc(incomes.id));
    return NextResponse.json(allIncome);
  } catch (e) {
    console.error("[GET /api/income]", e);
    return NextResponse.json({ error: "Failed to load income" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { description, source, amount, incomeDate, paymentMethod, notes } = body;

    if (!description || amount === undefined || !incomeDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const incomeDateObj = new Date(incomeDate);
    const amountNumber = Number(amount);

    if (Number.isNaN(amountNumber)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const inserted = await db
      .insert(incomes)
      .values({
        description,
        source,
        amount: amountNumber.toFixed(2),
        incomeDate: incomeDateObj,
        paymentMethod,
        notes,
        status: "pending",
      })
      .returning();

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (e) {
    console.error("[POST /api/income]", e);
    return NextResponse.json({ error: "Failed to create income record" }, { status: 500 });
  }
}
