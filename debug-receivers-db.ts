import { db } from "./src/lib/db";
import { receiverPersons } from "./src/lib/schema";

async function debugReceivers() {
  console.log("📊 Fetching all receivers from database...");
  const all = await db.select().from(receiverPersons);
  console.log("All receivers in database:");
  all.forEach((r, idx) => {
    console.log(`  [${idx}] id=${r.id}, name="${r.name}" (length: ${r.name.length}), role=${r.role}, sortOrder=${r.sortOrder}`);
  });
  console.log(`\nTotal: ${all.length} receivers`);
  
  // Check for "TRIAL" or "trial" in any form
  const trialRecords = all.filter(r => r.name.toLowerCase().includes("trial"));
  if (trialRecords.length > 0) {
    console.log("\n⚠️ Found TRIAL-like records:");
    trialRecords.forEach(r => {
      console.log(`  - "${r.name}" (exact name, length: ${r.name.length})`);
    });
  }
}

debugReceivers().catch(console.error).finally(() => process.exit(0));
