import { db } from "@/lib/db";
import { bookings, unitConfigs } from "@/lib/schema";
import { eq, or } from "drizzle-orm";

async function main() {
  console.log("Removing units 1245, 2208, and 2209...");

  const unitsToRemove = ["1245", "2208", "2209"];

  // Delete all bookings for these units
  for (const unit of unitsToRemove) {
    const deleted = await db
      .delete(bookings)
      .where(eq(bookings.unit, unit))
      .returning();

    console.log(`✓ Deleted ${deleted.length} bookings for unit ${unit}`);
  }

  // Remove units from unit_configs table
  for (const unit of unitsToRemove) {
    await db.delete(unitConfigs).where(eq(unitConfigs.code, unit));
    console.log(`✓ Removed unit ${unit} from configurations`);
  }

  console.log("\n✓ Successfully removed all data for units 1245, 2208, and 2209");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
