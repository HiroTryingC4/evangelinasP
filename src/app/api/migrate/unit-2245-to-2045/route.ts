import { db } from "@/lib/db";
import { bookings, unitConfigs } from "@/lib/schema";
import { eq, or } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const legacyUnits = [
      "2245",
      "Unit 2245",
      "unit 2245",
      "Uit 2245",
      "uit 2245",
      "Unit 2045",
      "unit 2045",
      "Uit 2045",
      "uit 2045",
    ];

    const updateResult = await db
      .update(bookings)
      .set({ unit: "2045" })
      .where(or(...legacyUnits.map((value) => eq(bookings.unit, value))))
      .returning();

    await db.delete(unitConfigs).where(eq(unitConfigs.code, "2245"));
    await db
      .insert(unitConfigs)
      .values({ code: "2045", sortOrder: 4 })
      .onConflictDoNothing();

    return Response.json({
      success: true,
      message: "Migration completed successfully!",
      updatedCount: updateResult.length,
      details: `Transferred ${updateResult.length} bookings to unit 2045`,
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
