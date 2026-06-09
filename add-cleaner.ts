import { db } from "./src/lib/db";
import { receiverPersons } from "./src/lib/schema";

async function addCleaner() {
  try {
    const result = await db
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
    all.forEach(r => console.log(`  - ${r.name}`));
  } catch (e) {
    console.error("❌ Error:", e);
  } finally {
    process.exit(0);
  }
}

addCleaner();
