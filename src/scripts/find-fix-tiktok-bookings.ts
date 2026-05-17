import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables FIRST
config({ path: resolve(process.cwd(), ".env.local") });

import { db } from "../lib/db";
import { bookings } from "../lib/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

async function findAndFixTikTokBookings() {
  console.log("\n🔍 Finding all TikTok bookings for May 10-16, 2026...\n");

  try {
    // Find all TikTok bookings in the date range
    const tiktokBookings = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.bookingPlatform, "TikTok"),
          gte(bookings.checkInDateKey, "2026-05-10"),
          lte(bookings.checkInDateKey, "2026-05-16")
        )
      )
      .orderBy(bookings.checkInDateKey);

    console.log(`📊 Found ${tiktokBookings.length} TikTok bookings:\n`);

    // Group by booking source
    const bySource: Record<string, typeof tiktokBookings> = {};
    tiktokBookings.forEach((booking) => {
      const source = booking.bookingSource || "NULL";
      if (!bySource[source]) bySource[source] = [];
      bySource[source].push(booking);
    });

    console.log("📋 Breakdown by booking source:");
    Object.entries(bySource).forEach(([source, bookings]) => {
      console.log(`   ${source}: ${bookings.length} bookings`);
    });
    console.log("");

    // Show bookings that are NOT RIEMAR
    const notRiemar = tiktokBookings.filter(
      (b) => b.bookingSource !== "RIEMAR"
    );

    if (notRiemar.length > 0) {
      console.log(`⚠️  Found ${notRiemar.length} TikTok bookings NOT assigned to RIEMAR:\n`);
      notRiemar.forEach((booking) => {
        console.log(
          `   ID ${booking.id}: ${booking.guestName} (${booking.checkInDateKey}) - Current: ${booking.bookingSource || "NULL"}`
        );
      });
      console.log("");

      // Ask if we should fix them
      console.log("🔧 Fixing these bookings to set bookingSource = 'RIEMAR'...\n");

      for (const booking of notRiemar) {
        await db
          .update(bookings)
          .set({ bookingSource: "RIEMAR" })
          .where(eq(bookings.id, booking.id));

        console.log(
          `   ✅ Updated ID ${booking.id}: ${booking.guestName} → RIEMAR`
        );
      }

      console.log(`\n✅ Fixed ${notRiemar.length} bookings!`);
    } else {
      console.log("✅ All TikTok bookings are already assigned to RIEMAR!");
    }

    // Verify the fix
    console.log("\n🔍 Verifying...");
    const afterFix = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.bookingPlatform, "TikTok"),
          gte(bookings.checkInDateKey, "2026-05-10"),
          lte(bookings.checkInDateKey, "2026-05-16")
        )
      );

    const stillNotRiemar = afterFix.filter((b) => b.bookingSource !== "RIEMAR");

    if (stillNotRiemar.length === 0) {
      console.log(`✅ All ${afterFix.length} TikTok bookings are now assigned to RIEMAR!`);
    } else {
      console.log(`❌ Still ${stillNotRiemar.length} bookings not assigned to RIEMAR`);
    }

    // Show summary
    console.log("\n📊 Final Summary:");
    console.log(`   Total TikTok bookings: ${afterFix.length}`);
    console.log(`   Assigned to RIEMAR: ${afterFix.filter((b) => b.bookingSource === "RIEMAR").length}`);
    console.log("");

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

findAndFixTikTokBookings()
  .then(() => {
    console.log("✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
