import { db } from "./src/lib/db";
import { bookings } from "./src/lib/schema";

function getCollectedForBooking(booking: any): number {
  return (booking.dpAmount || 0) + (booking.fpAmount || 0) + (booking.apAmount || 0);
}

async function findMay1642() {
  console.log("🔍 Finding the ₱1,642 waiting payment in May 2026...\n");

  const allBookings = await db.select().from(bookings);
  
  // Filter for May 2026 check-ins
  const may2026Bookings = allBookings.filter(booking => {
    const checkInDate = new Date(booking.checkIn);
    const year = checkInDate.getFullYear();
    const month = checkInDate.getMonth(); // 0-indexed: 4=May
    return year === 2026 && month === 4;
  });

  console.log(`Found ${may2026Bookings.length} bookings in May 2026\n`);

  let totalRevenue = 0;
  let totalCollected = 0;
  let totalWaiting = 0;
  const unpaidBookings: any[] = [];

  may2026Bookings.forEach((booking) => {
    const collected = getCollectedForBooking(booking);
    const waiting = Math.max(0, booking.totalFee - collected);
    
    totalRevenue += booking.totalFee;
    totalCollected += collected;
    totalWaiting += waiting;

    if (waiting > 0) {
      unpaidBookings.push({
        ...booking,
        collected,
        waiting
      });
    }
  });

  console.log(`📊 May 2026 Totals:`);
  console.log(`   Total Revenue: ₱${totalRevenue.toLocaleString()}`);
  console.log(`   Collected: ₱${totalCollected.toLocaleString()}`);
  console.log(`   Waiting: ₱${totalWaiting.toLocaleString()}`);
  console.log(`\n🔴 Bookings with unpaid balance (${unpaidBookings.length}):\n`);

  unpaidBookings.forEach((booking, index) => {
    console.log(`${index + 1}. ${booking.guestName}`);
    console.log(`   Unit: ${booking.unit}`);
    console.log(`   Check-in: ${booking.checkIn.toLocaleDateString()}`);
    console.log(`   Total Fee: ₱${booking.totalFee.toLocaleString()}`);
    console.log(`   Collected: ₱${booking.collected.toLocaleString()} (DP: ₱${booking.dpAmount}, FP: ₱${booking.fpAmount}${booking.apAmount ? `, AP: ₱${booking.apAmount}` : ''})`);
    console.log(`   Waiting: ₱${booking.waiting.toLocaleString()}`);
    console.log(`   Status: ${booking.paymentStatus}`);
    console.log(`   Booked by: ${booking.bookingSource}`);
    console.log("");
  });
}

findMay1642()
  .then(() => {
    console.log("✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
