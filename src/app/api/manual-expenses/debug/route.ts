import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { manualExpenses } from "@/lib/schema";
import { ensureManualExpensesTable } from "@/lib/db-health";

export const dynamic = "force-dynamic";

// GET: Debug endpoint to see all manual expenses in the database
export async function GET() {
  try {
    await ensureManualExpensesTable();
    
    // Get all records using Drizzle ORM with explicit columns
    const allExpenses = await db
      .select({
        id: manualExpenses.id,
        weekStart: manualExpenses.weekStart,
        weekEnd: manualExpenses.weekEnd,
        receiver: manualExpenses.receiver,
        amount: manualExpenses.amount,
        comment: manualExpenses.comment,
        type: manualExpenses.type,
        expenseDate: manualExpenses.expenseDate,
        createdAt: manualExpenses.createdAt,
      })
      .from(manualExpenses);
    
    return NextResponse.json({
      total: allExpenses.length,
      expenses: allExpenses,
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    return NextResponse.json(
      { error: "Failed to fetch debug info", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// DELETE: Clear all manual expenses (debug only)
export async function DELETE(request: NextRequest) {
  try {
    console.log("??? Clearing all manual expenses using Drizzle ORM...");
    await ensureManualExpensesTable();
    
    // Use Drizzle ORM delete instead of raw SQL
    const deleted = await db.delete(manualExpenses);
    
    console.log("? All manual expenses cleared");
    console.log("Deleted result:", deleted);
    
    return NextResponse.json({ 
      success: true, 
      message: "All manual expenses cleared",
      deletedCount: Array.isArray(deleted) ? deleted.length : "Success"
    });
  } catch (error) {
    console.error("? Error clearing manual expenses:", error);
    return NextResponse.json(
      { error: "Failed to clear manual expenses", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
