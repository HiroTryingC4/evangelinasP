import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manualExpenses, expenses, bills } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { ensureManualExpensesTable } from "@/lib/db-health";

export const dynamic = "force-dynamic";

// GET: Fetch manual expenses for a specific week and receiver
export async function GET(request: NextRequest) {
  try {
    await ensureManualExpensesTable();
    
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("weekStart");
    const weekEnd = searchParams.get("weekEnd");
    const receiver = searchParams.get("receiver");

    if (!weekStart || !weekEnd || !receiver) {
      return NextResponse.json(
        { error: "Missing required parameters: weekStart, weekEnd, receiver" },
        { status: 400 }
      );
    }

    const expenses = await db
      .select()
      .from(manualExpenses)
      .where(
        and(
          eq(manualExpenses.weekStart, weekStart),
          eq(manualExpenses.weekEnd, weekEnd),
          eq(manualExpenses.receiver, receiver)
        )
      );

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("Error fetching manual expenses:", error);
    return NextResponse.json(
      { error: "Failed to fetch manual expenses" },
      { status: 500 }
    );
  }
}

// POST: Create a new manual expense
export async function POST(request: NextRequest) {
  try {
    console.log("📝 POST /api/manual-expenses - Ensuring table exists...");
    await ensureManualExpensesTable();
    console.log("✅ Table ensured");
    
    const body = await request.json();
    console.log("📦 Received body:", body);
    const { weekStart, weekEnd, receiver, amount, comment, type = "expense" } = body;

    if (!weekStart || !weekEnd || !receiver || !amount || !comment) {
      console.error("❌ Missing required fields:", { weekStart, weekEnd, receiver, amount, comment });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("💾 Inserting manual expense:", { weekStart, weekEnd, receiver, amount: Number(amount), comment, type });
    const [newExpense] = await db
      .insert(manualExpenses)
      .values({
        weekStart,
        weekEnd,
        receiver,
        amount: Number(amount),
        comment,
        type: type || "expense",
      })
      .returning();

    console.log("✅ Manual expense created:", newExpense);

    // Create a corresponding entry in the Finances system (bill, wage, or expense)
    try {
      const financeAmount = Number(amount);
      const financeDate = new Date(weekStart); // Use week start date

      if (type === "bill") {
        console.log("💳 Creating corresponding Finances bill...");
        
        const [financeBill] = await db
          .insert(bills)
          .values({
            description: comment, // Use comment directly as description
            amount: financeAmount,
            billDate: financeDate,
            dueDate: null,
            category: null,
            paymentMethod: null,
            notes: null,
            status: "paid",
          })
          .returning();

        console.log("✅ Finances bill created:", financeBill);
      } else if (type === "wage") {
        console.log("👤 Creating corresponding Finances wage...");
        const { wages } = await import("@/lib/schema");
        
        const [financeWage] = await db
          .insert(wages)
          .values({
            employeeName: comment, // Use comment directly as employee name
            amount: financeAmount,
            payDate: financeDate,
            dueDate: null,
            paymentMethod: null,
            notes: null,
            status: "paid",
          })
          .returning();

        console.log("✅ Finances wage created:", financeWage);
      } else {
        console.log("💰 Creating corresponding Finances expense...");
        
        const [financeExpense] = await db
          .insert(expenses)
          .values({
            description: comment, // Use comment directly as description
            amount: financeAmount.toFixed(2),
            expenseDate: financeDate,
            dueDate: null,
            category: null,
            paymentMethod: null,
            notes: null,
            status: "paid",
          })
          .returning();

        console.log("✅ Finances expense created:", financeExpense);
      }
    } catch (financeError) {
      console.error(`⚠️ Failed to create Finances ${type} (manual expense still created):`, financeError);
      // Don't fail the whole request if finance entry creation fails
    }

    return NextResponse.json(newExpense, { status: 201 });
  } catch (error) {
    console.error("❌ Error creating manual expense:", error);
    return NextResponse.json(
      { error: "Failed to create manual expense", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// DELETE: Remove a manual expense by ID
export async function DELETE(request: NextRequest) {
  try {
    console.log("🗑️ DELETE /api/manual-expenses - Ensuring table exists...");
    await ensureManualExpensesTable();
    console.log("✅ Table ensured");
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    console.log("🔍 Deleting expense with ID:", id);

    if (!id) {
      console.error("❌ Missing expense ID");
      return NextResponse.json(
        { error: "Missing expense ID" },
        { status: 400 }
      );
    }

    // First, get the manual expense details to find matching Finances entry
    const manualExpensesToDelete = await db
      .select()
      .from(manualExpenses)
      .where(eq(manualExpenses.id, Number(id)));

    if (manualExpensesToDelete.length === 0) {
      console.error("❌ Manual expense not found");
      return NextResponse.json(
        { error: "Manual expense not found" },
        { status: 404 }
      );
    }

    const manualExpense = manualExpensesToDelete[0];
    console.log("🔍 Found manual expense:", manualExpense);

    // Delete from manual_expenses table
    const result = await db
      .delete(manualExpenses)
      .where(eq(manualExpenses.id, Number(id)))
      .returning();

    console.log("✅ Deleted from manual_expenses:", result);

    // Also delete from expenses, wages, or bills table using the comment directly
    try {
      const manualExpenseType = manualExpense.type || "expense";
      console.log(`🗑️ Deleting corresponding Finances ${manualExpenseType}:`, manualExpense.comment);
      
      if (manualExpenseType === "bill") {
        // Delete from bills table
        const deletedFinanceBills = await db
          .delete(bills)
          .where(sql`description = ${manualExpense.comment}`)
          .returning();

        if (deletedFinanceBills.length > 0) {
          console.log("✅ Deleted from bills:", deletedFinanceBills);
        } else {
          console.warn("⚠️ No matching bill found with description:", manualExpense.comment);
        }
      } else if (manualExpenseType === "wage") {
        // Delete from wages table
        const { wages } = await import("@/lib/schema");
        const deletedFinanceWages = await db
          .delete(wages)
          .where(sql`employee_name = ${manualExpense.comment}`)
          .returning();

        if (deletedFinanceWages.length > 0) {
          console.log("✅ Deleted from wages:", deletedFinanceWages);
        } else {
          console.warn("⚠️ No matching wage found with employee name:", manualExpense.comment);
        }
      } else {
        // Delete from expenses table
        const deletedFinanceExpenses = await db
          .delete(expenses)
          .where(sql`description = ${manualExpense.comment}`)
          .returning();

        if (deletedFinanceExpenses.length > 0) {
          console.log("✅ Deleted from expenses:", deletedFinanceExpenses);
        } else {
          console.warn("⚠️ No matching expense found with description:", manualExpense.comment);
        }
      }
    } catch (financeError) {
      console.error("⚠️ Failed to delete Finances entry:", financeError);
      // Don't fail the whole request if finance deletion fails
    }

    return NextResponse.json({ success: true, deleted: result });
  } catch (error) {
    console.error("❌ Error deleting manual expense:", error);
    return NextResponse.json(
      { error: "Failed to delete manual expense", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// PUT: Update a manual expense by ID
export async function PUT(request: NextRequest) {
  try {
    console.log("✏️ PUT /api/manual-expenses - Ensuring table exists...");
    await ensureManualExpensesTable();
    console.log("✅ Table ensured");
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const body = await request.json();
    const { amount, comment } = body;

    console.log("🔍 Updating expense with ID:", id);

    if (!id) {
      console.error("❌ Missing expense ID");
      return NextResponse.json(
        { error: "Missing expense ID" },
        { status: 400 }
      );
    }

    if (amount === undefined || !comment) {
      console.error("❌ Missing required fields:", { amount, comment });
      return NextResponse.json(
        { error: "Missing required fields: amount, comment" },
        { status: 400 }
      );
    }

    // First, get the old manual expense to find the old Finances entry
    const oldManualExpenses = await db
      .select()
      .from(manualExpenses)
      .where(eq(manualExpenses.id, Number(id)));

    if (oldManualExpenses.length === 0) {
      console.error("❌ Expense not found with ID:", id);
      return NextResponse.json(
        { error: "Expense not found" },
        { status: 404 }
      );
    }

    const oldManualExpense = oldManualExpenses[0];
    const manualExpenseType = oldManualExpense.type || "expense";

    // Update the manual_expenses table
    const result = await db
      .update(manualExpenses)
      .set({
        amount: Number(amount),
        comment: comment.trim(),
      })
      .where(eq(manualExpenses.id, Number(id)))
      .returning();

    console.log("✅ Updated manual expense:", result[0]);

    // Also update the corresponding Finances entry based on type
    try {
      console.log(`📝 Updating corresponding Finances ${manualExpenseType}...`);
      
      if (manualExpenseType === "bill") {
        // Update in bills table
        const updatedFinanceBills = await db
          .update(bills)
          .set({
            description: comment.trim(),
            amount: Number(amount),
          })
          .where(sql`description = ${oldManualExpense.comment}`)
          .returning();

        if (updatedFinanceBills.length > 0) {
          console.log("✅ Updated Finances bill:", updatedFinanceBills[0]);
        } else {
          console.warn("⚠️ No matching bill found with description:", oldManualExpense.comment);
        }
      } else if (manualExpenseType === "wage") {
        // Update in wages table
        const { wages } = await import("@/lib/schema");
        const updatedFinanceWages = await db
          .update(wages)
          .set({
            employeeName: comment.trim(),
            amount: Number(amount),
          })
          .where(sql`employee_name = ${oldManualExpense.comment}`)
          .returning();

        if (updatedFinanceWages.length > 0) {
          console.log("✅ Updated Finances wage:", updatedFinanceWages[0]);
        } else {
          console.warn("⚠️ No matching wage found with employee name:", oldManualExpense.comment);
        }
      } else {
        // Update in expenses table
        const updatedFinanceExpenses = await db
          .update(expenses)
          .set({
            description: comment.trim(),
            amount: Number(amount).toFixed(2),
          })
          .where(sql`description = ${oldManualExpense.comment}`)
          .returning();

        if (updatedFinanceExpenses.length > 0) {
          console.log("✅ Updated Finances expense:", updatedFinanceExpenses[0]);
        } else {
          console.warn("⚠️ No matching expense found with description:", oldManualExpense.comment);
        }
      }
    } catch (financeError) {
      console.error("⚠️ Failed to update Finances entry:", financeError);
      // Don't fail the whole request if finance update fails
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("❌ Error updating manual expense:", error);
    return NextResponse.json(
      { error: "Failed to update manual expense", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
