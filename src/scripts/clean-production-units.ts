import { db } from "@/lib/db";
import { unitConfigs } from "@/lib/schema";
import { eq, or } from "drizzle-orm";

async function main() {
  console.log("Cleaning production unit configs...\n");

  // Remove units 1245, 2208, 2209 from unit_configs
  const deleted = await db
    .delete(unitConfigs)
    .where(
      or(
        eq(unitConfigs.code, "1245"),
        eq(unitConfigs.code, "2208"),
        eq(unitConfigs.code, "2209")
      )
    )
    .returning();

  console.log(`✓ Removed ${deleted.length} unit configs`);
  deleted.forEach((u) => {
    console.log(`  - ${u.code}`);
  });

  // Show remaining units
  const remaining = await db.select().from(unitConfigs);
  console.log(`\n✓ Remaining unit configs:`);
  remaining.forEach((u) => {
    console.log(`  - ${u.code}`);
  });

  console.log("\n✓ Production units cleaned successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
