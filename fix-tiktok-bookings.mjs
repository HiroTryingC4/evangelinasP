import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, ".env.local") });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql as sqlTag } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function findAndFixTikTokBookings() {
  console.log("\n🔍 Finding all TikTok bookings for May 10-16, 2026...\n");

  try {
    // Find all TikTok bookings in the date range
    const result = await db.execute(sqlTag`
      SELECT * FROM bookings 
      WHERE booking_platform = 'TikTok'
        AND check_in_date_key >= '2026-05-10'
        AND check_in_date_key <= '2026-05-16'
      ORDER BY check_in_date_key
    `);

    const tiktokBookings = result.rows;
    console.log(`📊 Found ${tiktokBookings.length} TikTok bookings:\n`);

    // Group by booking source
    const bySource = {};
    tiktokBookings.forEach((booking) => {
      const source = booking.booking_source || "NULL";
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
      (b) => b.booking_source !== "RIEMAR"
    );

    if (notRiemar.length > 0) {
      console.log(`⚠️  Found ${notRiemar.length} TikTok bookings NOT assigned to RIEMAR:\n`);
      notRiemar.forEach((booking) => {
        console.log(
          `   ID ${booking.id}: ${booking.guest_name} (${booking.check_in_date_key}) - Current: ${booking.booking_source || "NULL"}`
        );
      });
      console.log("");

      console.log("🔧 Fixing these bookings to set booking_source = 'RIEMAR'...\n");

      for (const booking of notRiemar) {
        await db.execute(sqlTag`
          UPDATE bookings 
          SET booking_source = 'RIEMAR'
          WHERE id = ${booking.id}
        `);

        console.log(
          `   ✅ Updated ID ${booking.id}: ${booking.guest_name} → RIEMAR`
        );
      }

      console.log(`\n✅ Fixed ${notRiemar.length} bookings!`);
    } else {
      console.log("✅ All TikTok bookings are already assigned to RIEMAR!");
    }

    // Verify the fix
    console.log("\n🔍 Verifying...");
    const afterFixResult = await db.execute(sqlTag`
      SELECT * FROM bookings 
      WHERE booking_platform = 'TikTok'
        AND check_in_date_key >= '2026-05-10'
        AND check_in_date_key <= '2026-05-16'
    `);

    const afterFix = afterFixResult.rows;
    const stillNotRiemar = afterFix.filter((b) => b.booking_source !== "RIEMAR");

    if (stillNotRiemar.length === 0) {
      console.log(`✅ All ${afterFix.length} TikTok bookings are now assigned to RIEMAR!`);
    } else {
      console.log(`❌ Still ${stillNotRiemar.length} bookings not assigned to RIEMAR`);
    }

    // Show summary
    console.log("\n📊 Final Summary:");
    console.log(`   Total TikTok bookings: ${afterFix.length}`);
    console.log(`   Assigned to RIEMAR: ${afterFix.filter((b) => b.booking_source === "RIEMAR").length}`);
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
