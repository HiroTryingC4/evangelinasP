import { db } from "@/lib/db";
import { receiverPersons } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";

async function deleteInvalidReceivers() {
  try {
    console.log("🗑️  Deleting NONE and HAHA from receiver_persons...");
    
    const result = await db
      .delete(receiverPersons)
      .where(inArray(receiverPersons.name, ["NONE", "HAHA"]))
      .returning();
    
    if (result.length > 0) {
      console.log("✅ Successfully deleted:", result.map((r) => r.name).join(", "));
    } else {
      console.log("ℹ️  No NONE or HAHA records found to delete");
    }
    
    // Show remaining receivers
    const remaining = await db.select().from(receiverPersons);
    console.log("📋 Remaining receivers:", remaining.map((r) => r.name).join(", "));
  } catch (error) {
    console.error("❌ Error deleting receivers:", error);
    process.exit(1);
  }
}

deleteInvalidReceivers();
