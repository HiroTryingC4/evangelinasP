import { db } from "@/lib/db";
import { receiverPersons, persons } from "@/lib/schema";

async function main() {
  console.log("Adding NONE and JAYJAY to receivers...");

  // Add to receiver_persons table
  await db
    .insert(receiverPersons)
    .values({ name: "NONE", role: "employee", sortOrder: 100 })
    .onConflictDoNothing();

  await db
    .insert(receiverPersons)
    .values({ name: "JAYJAY", role: "employee", sortOrder: 101 })
    .onConflictDoNothing();

  // Add to persons table (for transfers/payments)
  await db
    .insert(persons)
    .values({ name: "none", type: "recipient", balance: "0" })
    .onConflictDoNothing();

  await db
    .insert(persons)
    .values({ name: "jayjay", type: "recipient", balance: "0" })
    .onConflictDoNothing();

  console.log("✓ Successfully added NONE and JAYJAY to receivers");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
