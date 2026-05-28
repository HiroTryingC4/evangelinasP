import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { receiverPersons, persons } from "@/lib/schema";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Debug endpoint to see what's actually in the database
export async function GET() {
  try {
    const receivers = await db
      .select()
      .from(receiverPersons)
      .orderBy(asc(receiverPersons.sortOrder), asc(receiverPersons.id));

    return NextResponse.json({
      success: true,
      count: receivers.length,
      receivers: receivers,
      message: "These are the receivers currently in the database",
    });
  } catch (error) {
    console.error("Error fetching receivers:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

// DELETE endpoint to manually remove a receiver by name
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json({
        success: false,
        error: "Missing 'name' parameter",
      }, { status: 400 });
    }

    const deleted = await db
      .delete(receiverPersons)
      .where(eq(receiverPersons.name, name))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({
        success: false,
        message: `Receiver '${name}' not found in database`,
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted receiver '${name}'`,
      deleted: deleted[0],
    });
  } catch (error) {
    console.error("Error deleting receiver:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

// POST endpoint to manually add a receiver
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, role = "employee", sortOrder = 100 } = body;

    if (!name) {
      return NextResponse.json({
        success: false,
        error: "Missing 'name' parameter",
      }, { status: 400 });
    }

    // Add to receiverPersons table
    const insertedReceiver = await db
      .insert(receiverPersons)
      .values({
        name,
        role,
        sortOrder,
      })
      .onConflictDoNothing()
      .returning();

    // Add to persons table
    await db
      .insert(persons)
      .values({
        name: name.toLowerCase(),
        type: "recipient",
        balance: "0",
      })
      .onConflictDoNothing();

    return NextResponse.json({
      success: true,
      message: `Successfully added receiver '${name}'`,
      receiver: insertedReceiver[0] || { name, role, sortOrder },
    });
  } catch (error) {
    console.error("Error adding receiver:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
