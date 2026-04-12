import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wages } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");

    let query: any = db.select().from(wages);
    if (status) {
      query = query.where(eq(wages.status, status));
    }

    const allWages = await query.orderBy(desc(wages.payDate), desc(wages.id));

    return NextResponse.json(allWages);
  } catch (e) {
    console.error("[GET /api/wages]", e);
    return NextResponse.json({ error: "Failed to load wages" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeName, amount, payDate, dueDate, paymentMethod, notes } = body;

    if (!employeeName || amount === undefined || !payDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const payDateObj = new Date(payDate);
    const dueDateObj = dueDate ? new Date(dueDate) : null;

    const inserted = await db
      .insert(wages)
      .values({
        employeeName,
        amount: Math.round(amount),
        payDate: payDateObj,
        dueDate: dueDateObj,
        paymentMethod,
        notes,
        status: "pending",
      })
      .returning();

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (e) {
    console.error("[POST /api/wages]", e);
    return NextResponse.json({ error: "Failed to create wage record" }, { status: 500 });
  }
}
