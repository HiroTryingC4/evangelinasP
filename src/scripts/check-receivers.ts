import { db } from "@/lib/db";
import { receiverPersons } from "@/lib/schema";

async function main() {
  console.log("Checking receivers in database...");

  const receivers = await db.select().from(receiverPersons);

  console.log("\nCurrent receivers:");
  receivers.forEach((r) => {
    console.log(`- ${r.name} (${r.role}, sortOrder: ${r.sortOrder})`);
  });

  console.log(`\nTotal: ${receivers.length} receivers`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
