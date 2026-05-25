import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  try {
    const { db } = await import("./src/lib/db");
    const { bookings } = await import("./src/lib/schema");
    const { eq } = await import("drizzle-orm");

    console.log("Reverting Business Gcash James → RIEMAR...");

    // Update all bookings with Business Gcash James back to RIEMAR
    const result = await db
      .update(bookings)
      .set({ dpReceivedBy: "RIEMAR" })
      .where(eq(bookings.dpReceivedBy, "Business Gcash James"));

    const result2 = await db
      .update(bookings)
      .set({ fpReceivedBy: "RIEMAR" })
      .where(eq(bookings.fpReceivedBy, "Business Gcash James"));

    console.log("✅ Reverted: Business Gcash James → RIEMAR");
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

main();
