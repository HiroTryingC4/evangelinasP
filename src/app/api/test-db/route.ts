import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    console.log("🧪 Testing database connection...");
    
    // Test 1: Check if we can connect
    const connectionTest = await db.execute(sql`SELECT NOW() as current_time`);
    console.log("✅ Database connection successful:", connectionTest.rows[0]);
    
    // Test 2: Check if manual_expenses table exists
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'manual_expenses'
      ) as table_exists
    `);
    console.log("📋 Table exists check:", tableCheck.rows[0]);
    
    // Test 3: If table exists, get count and sample data
    let tableData = null;
    if (tableCheck.rows[0].table_exists) {
      const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM manual_expenses`);
      const sampleData = await db.execute(sql`SELECT * FROM manual_expenses ORDER BY created_at DESC LIMIT 10`);
      tableData = {
        count: countResult.rows[0],
        sample: sampleData.rows,
      };
      console.log("📊 Table data:", tableData);
    }
    
    return NextResponse.json({
      success: true,
      connection: connectionTest.rows[0],
      tableExists: tableCheck.rows[0].table_exists,
      tableData,
    });
  } catch (error) {
    console.error("❌ Database test failed:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
