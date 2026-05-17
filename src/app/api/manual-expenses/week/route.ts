import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manualExpenses } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
import { ensureManualExpensesTable } from "@/lib/db-health";

export const dynamic = "force-dynamic";

// GET: Fetch all manual expenses for a specific week (across all receivers)
export async function GET(request: NextRequest) {
  try {
    await ensureManualExpensesTable();
    
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart");
    const weekEnd = searchParams.get("weekEnd");

    if (!weekStart || !weekEnd) {
      return NextResponse.json(
        { error: "Missing required parameters: weekStart, weekEnd" },
        { status: 400 }
      );
    }

    const expenses = await db
      .select()
      .from(manualExpenses)
      .where(
        and(
          eq(manualExpenses.weekStart, weekStart),
          eq(manualExpenses.weekEnd, weekEnd)
        )
      );

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("Error fetching weekly manual expenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch weekly manual expenses" },
      { status: 500 }
    );
  }
}
