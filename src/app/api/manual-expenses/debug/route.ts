import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { ensureManualExpensesTable } from "@/lib/db-health";

export const dynamic = "force-dynamic";

// GET: Debug endpoint to see all manual expenses in the database
export async function GET() {
  try {
    await ensureManualExpensesTable();
    
    // Get all records
    const result = await db.execute(sql`SELECT * FROM manual_expenses ORDER BY created_at DESC LIMIT 50`);
    
    // Get count
    const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM manual_expenses`);
    
    return NextResponse.json({
      total: countResult.rows[0],
      expenses: result.rows,
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    return NextResponse.json(
      { error: "Failed to fetch debug info", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
