import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manualExpenses } from "@/lib/schema";
import { and, eq, sql } from "drizzle-orm";
import { ensureManualExpensesTable } from "@/lib/db-health";

export const dynamic = "force-dynamic";

// GET: Fetch all manual expenses for a specific week (across all receivers)
export async function GET(request: NextRequest) {
  try {
    console.log("📖 GET /api/manual-expenses/week - Ensuring table exists...");
    await ensureManualExpensesTable();
    console.log("✅ Table ensured");
    
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart");
    const weekEnd = searchParams.get("weekEnd");

    console.log("🔍 Fetching expenses for:", { weekStart, weekEnd });

    if (!weekStart || !weekEnd) {
      return NextResponse.json(
        { error: "Missing required parameters: weekStart, weekEnd" },
        { status: 400 }
      );
    }

    // Use raw SQL because Drizzle ORM is not finding the records
    const result = await db.execute(sql`
      SELECT * FROM manual_expenses 
      WHERE week_start = ${weekStart} AND week_end = ${weekEnd}
      ORDER BY created_at DESC
    `);
    
    const expenses = result.rows.map((row: any) => ({
      id: row.id,
      weekStart: row.week_start,
      weekEnd: row.week_end,
      receiver: row.receiver,
      amount: row.amount,
      comment: row.comment,
      createdAt: row.created_at,
    }));

    console.log(`✅ Found ${expenses.length} expenses`);
    
    return NextResponse.json(expenses);
  } catch (error) {
    console.error("❌ Error fetching weekly manual expenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch weekly manual expenses", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
