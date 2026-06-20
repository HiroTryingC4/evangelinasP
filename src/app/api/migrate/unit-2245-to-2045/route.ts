import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    // Update all bookings with unit 2245 to 2045
    const updateResult = await db
      .update(bookings)
      .set({ unit: "2045" })
      .where(eq(bookings.unit, "2245"))
      .returning();

    return Response.json({
      success: true,
      message: "Migration completed successfully!",
      updatedCount: updateResult.length,
      details: `Transferred ${updateResult.length} bookings from unit 2245 to unit 2045`,
    });
  } catch (error) {
    console.error("Migration failed:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Migration failed",
      },
      { status: 500 }
    );
  }
}
