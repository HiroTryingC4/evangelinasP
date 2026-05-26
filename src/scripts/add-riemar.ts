import { db } from "@/lib/db";
import { receiverPersons, persons } from "@/lib/schema";

async function main() {
  console.log("Adding RIEMAR to receivers...");

  // Add to receiver_persons table
  await db
    .insert(receiverPersons)
    .values({ name: "RIEMAR", role: "employee", sortOrder: 102 })
    .onConflictDoNothing();

  // Add to persons table (for transfers/payments)
  await db
    .insert(persons)
    .values({ name: "riemar", type: "recipient", balance: "0" })
    .onConflictDoNothing();

  console.log("✓ Successfully added RIEMAR to receivers");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
