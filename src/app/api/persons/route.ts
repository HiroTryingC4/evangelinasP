import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { persons } from "@/lib/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allPersons = await db
      .select()
      .from(persons)
      .orderBy(desc(persons.updatedAt));

    return NextResponse.json(allPersons);
  } catch (error) {
    console.error("GET /api/persons:", error);
    return NextResponse.json(
      { error: "Failed to fetch persons" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, type = "recipient", notes } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const newPerson = await db
      .insert(persons)
      .values({
        name: name.toLowerCase(),
        type,
        balance: "0",
        notes: notes || null,
      })
      .returning();

    return NextResponse.json(newPerson[0], { status: 201 });
  } catch (error) {
    console.error("POST /api/persons:", error);
    return NextResponse.json(
      { error: "Failed to create person" },
      { status: 500 }
    );
  }
}
