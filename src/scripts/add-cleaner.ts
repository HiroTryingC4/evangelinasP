import { db } from "../lib/db.ts";
import { receiverPersons } from "../lib/schema.ts";

async function main() {
  try {
    await db
      .insert(receiverPersons)
      .values({ name: "Cleaner", role: "employee", sortOrder: 999 })
      .onConflictDoUpdate({
        target: receiverPersons.name,
        set: { role: "employee", sortOrder: 999 },
      });
    
    console.log("✅ Cleaner added successfully!");
    
    // Verify it was added
    const all = await db.select().from(receiverPersons);
    console.log("\nAll receivers:");
    all.forEach((r, idx) => console.log(`  [${idx}] ${r.name} (${r.role})`));
  } catch (e) {
    console.error("❌ Error:", e);
  }

  process.exit(0);
}

main();
