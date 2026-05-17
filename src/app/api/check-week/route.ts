import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart") || "2026-05-17";
    const weekEnd = searchParams.get("weekEnd") || "2026-05-23";
    
    console.log(`🔍 Checking expenses for week ${weekStart} to ${weekEnd}`);
    
    // Get all records for this week
    const records = await db.execute(sql`
      SELECT * FROM manual_expenses 
      WHERE week_start = ${weekStart} AND week_end = ${weekEnd}
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${records.rows.length} records:`, records.rows);
    
    // Get total count
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM manual_expenses
    `);
    
    return NextResponse.json({
      weekStart,
      weekEnd,
      recordsForWeek: records.rows,
      totalRecordsInDatabase: countResult.rows[0].count,
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
