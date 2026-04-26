import { db } from "@/lib/db";
import { receiverPersons, persons } from "@/lib/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Fixing receivers...");

  // Remove lowercase duplicate jayjay
  await db.delete(receiverPersons).where(eq(receiverPersons.name, "jayjay"));
  console.log("✓ Removed duplicate lowercase jayjay");

  // Add NONE if it doesn't exist
  await db
    .insert(receiverPersons)
    .values({ name: "NONE", role: "employee", sortOrder: 100 })
    .onConflictDoNothing();
  console.log("✓ Added NONE");

  // Add to persons table
  await db
    .insert(persons)
    .values({ name: "none", type: "recipient", balance: "0" })
    .onConflictDoNothing();

  console.log("\n✓ All done! Checking final list...");

  const receivers = await db.select().from(receiverPersons);
  console.log("\nFinal receivers:");
  receivers.forEach((r) => {
    console.log(`- ${r.name}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
