import { db } from "./src/lib/db";
import { bookings } from "./src/lib/schema";
import { sql } from "drizzle-orm";

async function checkAllBalance() {
  console.log("🔍 Checking ALL bookings with remaining balance...\n");

  // Query all bookings with remaining balance
  const allBookings = await db
    .select()
    .from(bookings)
    .where(sql`${bookings.remainingBalance} > 0`)
    .orderBy(bookings.checkIn);

  if (allBookings.length === 0) {
    console.log("✅ No bookings with remaining balance found");
    return;
  }

  console.log(`Found ${allBookings.length} booking(s) with remaining balance:\n`);

  let totalRemaining = 0;

  allBookings.forEach((booking, index) => {
    const checkInDate = new Date(booking.checkIn);
    const month = checkInDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    console.log(`${index + 1}. Guest: ${booking.guestName}`);
    console.log(`   Unit: ${booking.unit}`);
    console.log(`   Check-in: ${booking.checkIn.toLocaleDateString()} (${month})`);
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

  console.log(`\n💰 Total Remaining Balance (All Bookings): ₱${totalRemaining.toLocaleString()}`);
}

checkAllBalance()
  .then(() => {
    console.log("\n✅ Check complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
