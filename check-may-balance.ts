import { db } from "./src/lib/db";
import { bookings } from "./src/lib/schema";
import { sql } from "drizzle-orm";

async function checkMayBalance() {
  console.log("🔍 Checking May bookings (all years) with remaining balance...\n");

  // Query bookings with check-in in May (any year) that have remaining balance
  const mayBookings = await db
    .select()
    .from(bookings)
    .where(
      sql`EXTRACT(MONTH FROM ${bookings.checkIn}) = 5 
          AND ${bookings.remainingBalance} > 0`
    )
    .orderBy(bookings.checkIn);

  if (mayBookings.length === 0) {
    console.log("✅ No bookings with remaining balance found in May (any year)");
    return;
  }

  console.log(`Found ${mayBookings.length} booking(s) with remaining balance:\n`);

  let totalRemaining = 0;

  mayBookings.forEach((booking, index) => {
    console.log(`${index + 1}. Guest: ${booking.guestName}`);
    console.log(`   Unit: ${booking.unit}`);
    console.log(`   Check-in: ${booking.checkIn.toLocaleDateString()}`);
    console.log(`   Total Fee: ₱${booking.totalFee.toLocaleString()}`);
    console.log(`   DP Amount: ₱${booking.dpAmount.toLocaleString()}`);
    console.log(`   FP Amount: ₱${booking.fpAmount.toLocaleString()}`);
    if (booking.apAmount) {
      console.log(`   AP Amount: ₱${booking.apAmount.toLocaleString()}`);
    }
    console.log(`   Remaining Balance: ₱${booking.remainingBalance.toLocaleString()}`);
    console.log(`   Payment Status: ${booking.paymentStatus}`);
    console.log(`   Booking Source: ${booking.bookingSource}`);
    console.log("");

    totalRemaining += booking.remainingBalance;
  });

  console.log(`\n💰 Total Remaining Balance for May: ₱${totalRemaining.toLocaleString()}`);
}

checkMayBalance()
  .then(() => {
    console.log("\n✅ Check complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
