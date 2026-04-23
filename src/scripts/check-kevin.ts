import "dotenv/config";
import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

async function checkKevin() {
  try {
    const result = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.guestName, "Kevin Gambian"),
          eq(bookings.unit, "1116")
        )
      );

    if (result.length === 0) {
      console.log("Kevin Gambian not found");
      return;
    }

    const kevin = result[0];
    console.log("Kevin Gambian's Current Record:");
    console.log("- Total Fee:", kevin.totalFee);
    console.log("- DP Amount:", kevin.dpAmount);
    console.log("- DP Received By:", kevin.dpReceivedBy);
    console.log("- FP Amount:", kevin.fpAmount);
    console.log("- FP Received By:", kevin.fpReceivedBy);
    console.log("- Remaining Balance:", kevin.remainingBalance);
    console.log("- Payment Status:", kevin.paymentStatus);
    console.log("\nCalculated Paid Amount (DP + FP):", kevin.dpAmount + kevin.fpAmount);
    console.log("Calculated Paid Amount (Total - Remaining):", kevin.totalFee - kevin.remainingBalance);
  } catch (error) {
    console.error("Error:", error);
  }
}

checkKevin();
