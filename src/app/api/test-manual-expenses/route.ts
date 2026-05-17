import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manualExpenses } from "@/lib/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    console.log("🧪 Testing manual expenses functionality...");
    
    // Test 1: Check database connection
    const dbTest = await db.execute(sql`SELECT NOW() as time`);
    console.log("✅ Database connected:", dbTest.rows[0]);
    
    // Test 2: Check if table exists
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'manual_expenses'
      ) as exists
    `);
    console.log("✅ Table exists:", tableCheck.rows[0]);
    
    // Test 3: Try to insert a test record
    const testInsert = await db
      .insert(manualExpenses)
      .values({
        weekStart: "2026-05-17",
        weekEnd: "2026-05-23",
        receiver: "TEST_API",
        amount: 999,
        comment: "Test from API endpoint",
      })
      .returning();
    console.log("✅ Test insert:", testInsert[0]);
    
    // Test 4: Try to fetch it
    const testFetch = await db.execute(sql`
      SELECT * FROM manual_expenses 
      WHERE receiver = 'TEST_API'
    `);
    console.log("✅ Test fetch:", testFetch.rows);
    
    // Test 5: Try to delete it
    const testDelete = await db.execute(sql`
      DELETE FROM manual_expenses 
      WHERE receiver = 'TEST_API'
      RETURNING *
    `);
    console.log("✅ Test delete:", testDelete.rows);
    
    return NextResponse.json({
      success: true,
      message: "All tests passed!",
      tests: {
        connection: dbTest.rows[0],
        tableExists: tableCheck.rows[0],
        inserted: testInsert[0],
        fetched: testFetch.rows,
        deleted: testDelete.rows,
      },
    });
  } catch (error) {
    console.error("❌ Test failed:", error);
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
