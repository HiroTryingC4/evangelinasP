import { db } from "@/lib/db";
import { receiverPersons } from "@/lib/schema";

async function main() {
  const allReceivers = await db.select().from(receiverPersons).orderBy(receiverPersons.sortOrder);
  console.log("All receivers:");
  allReceivers.forEach((r) => console.log(`  - ${r.name}`));
  
  const riemar = allReceivers.find(r => r.name === 'RIEMAR');
  if (riemar) {
    console.log("\n✓ RIEMAR found!");
  } else {
    console.log("\n✗ RIEMAR not found - adding now...");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
