import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manualExpenses } from "@/lib/schema";
import { and, eq, desc } from "drizzle-orm";
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

    // Use Drizzle ORM select to ensure reads come from the primary connection
    const expenses = await db
      .select()
      .from(manualExpenses)
      .where(and(eq(manualExpenses.weekStart, weekStart), eq(manualExpenses.weekEnd, weekEnd)));

    // Map to API-friendly shape
    const mapped = expenses.map((row: any) => ({
      id: row.id,
      weekStart: row.weekStart,
      weekEnd: row.weekEnd,
      receiver: row.receiver,
      amount: row.amount,
      comment: row.comment,
      createdAt: row.createdAt,
    }));

    console.log(`✅ Found ${mapped.length} expenses`);
    
    return NextResponse.json(mapped);
  } catch (error) {
    console.error("❌ Error fetching weekly manual expenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch weekly manual expenses", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
