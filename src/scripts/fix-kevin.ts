import { readFileSync } from "fs";
import { resolve } from "path";

// Load env manually
const envPath = resolve(".env.local");
const envContent = readFileSync(envPath, "utf-8");
const lines = envContent.split("\n");
for (const line of lines) {
  const [key, ...valueParts] = line.split("=");
  if (key && key.trim()) {
    process.env[key.trim()] = valueParts.join("=").trim();
  }
}

// Now import and run the update
import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

async function fixKevin() {
  try {
    const result = await db
      .update(bookings)
      .set({
        totalFee: 1999,
        remainingBalance: 999,
        paymentStatus: "Partial Payment",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookings.guestName, "Kevin Gambian"),
          eq(bookings.unit, "1116")
        )
      );

    console.log("✅ Kevin's record fixed!");
    console.log("- Total Fee: 2000 → 1999");
    console.log("- Remaining Balance: 1000 → 999");
    console.log("- Paid Amount: 1000 (unchanged)");
    console.log("- Payment Status: Partial Payment");
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

fixKevin();
