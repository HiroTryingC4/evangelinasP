import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { eq } from "drizzle-orm";

async function updateTikTokToRiemar() {
  console.log("Updating all TikTok bookings to have RIEMAR as booking source...\n");

  // Find all TikTok bookings
  const tiktokBookings = await db
    .select()
    .from(bookings)
    .where(eq(bookings.bookingPlatform, "TikTok"));

  console.log(`Found ${tiktokBookings.length} TikTok bookings\n`);

  if (tiktokBookings.length === 0) {
    console.log("No TikTok bookings to update.");
    return;
  }

  // Update each TikTok booking to have RIEMAR as booking source
  let updated = 0;
  for (const booking of tiktokBookings) {
    if (booking.bookingSource !== "RIEMAR") {
      await db
        .update(bookings)
        .set({
          bookingSource: "RIEMAR",
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, booking.id));

      console.log(`✓ Updated booking #${booking.id} (${booking.guestName}): ${booking.bookingSource} → RIEMAR`);
      updated++;
    } else {
      console.log(`- Booking #${booking.id} (${booking.guestName}): Already RIEMAR`);
    }
  }

  console.log(`\n✅ Updated ${updated} TikTok bookings to RIEMAR`);
  console.log(`   ${tiktokBookings.length - updated} were already RIEMAR`);
}

updateTikTokToRiemar()
  .then(() => {
    console.log("\n✅ Migration complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
