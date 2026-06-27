import { db } from "@/lib/db";
import { bookings, unitConfigs } from "@/lib/schema";
import { eq, or } from "drizzle-orm";

async function migrateUnit() {
  try {
    console.log("Starting migration: Unit 2245 → 2045...");

    const bookingUpdate = await db
      .update(bookings)
      .set({ unit: "2045" })
      .where(
        or(
          eq(bookings.unit, "2245"),
          eq(bookings.unit, "Unit 2245"),
          eq(bookings.unit, "unit 2245")
        )
      )
      .returning({ id: bookings.id, unit: bookings.unit });

    await db.delete(unitConfigs).where(eq(unitConfigs.code, "2245"));
    await db
      .insert(unitConfigs)
      .values({ code: "2045", sortOrder: 4 })
      .onConflictDoNothing();

    console.log("✓ Migration completed successfully!");
    console.log(`Updated ${bookingUpdate.length} booking(s) from unit 2245 to 2045`);
    process.exit(0);
  } catch (error) {
    console.error("✗ Migration failed:", error);
    process.exit(1);
  }
}

migrateUnit();
