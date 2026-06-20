import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { eq } from "drizzle-orm";

async function migrateUnit() {
  try {
    console.log("Starting migration: Unit 2245 → 2045...");

    // Update all bookings with unit 2245 to 2045
    const result = await db
      .update(bookings)
      .set({ unit: "2045" })
      .where(eq(bookings.unit, "2245"));

    console.log("✓ Migration completed successfully!");
    console.log(`Updated bookings with unit 2245 to 2045`);
    process.exit(0);
  } catch (error) {
    console.error("✗ Migration failed:", error);
    process.exit(1);
  }
}

migrateUnit();
