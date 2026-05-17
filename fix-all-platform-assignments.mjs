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

async function fixAllPlatformAssignments() {
  console.log("\n🔧 Fixing platform assignments...\n");
  console.log("Rules:");
  console.log("  • TikTok → RIEMAR");
  console.log("  • Airbnb → SIR JAMES\n");

  try {
    // Fix TikTok bookings
    console.log("1️⃣ Checking TikTok bookings...");
    const tiktokResult = await db.execute(sqlTag`
      SELECT id, guest_name, booking_source, check_in_date_key
      FROM bookings 
      WHERE booking_platform = 'TikTok'
        AND booking_source != 'RIEMAR'
      ORDER BY check_in_date_key DESC
    `);

    if (tiktokResult.rows.length > 0) {
      console.log(`   Found ${tiktokResult.rows.length} TikTok bookings not assigned to RIEMAR:`);
      tiktokResult.rows.forEach((b) => {
        console.log(`      • ${b.guest_name} (${b.check_in_date_key}) - Currently: ${b.booking_source || 'NULL'}`);
      });

      console.log(`\n   Updating ${tiktokResult.rows.length} TikTok bookings to RIEMAR...`);
      const updateTikTok = await db.execute(sqlTag`
        UPDATE bookings 
        SET booking_source = 'RIEMAR'
        WHERE booking_platform = 'TikTok'
          AND booking_source != 'RIEMAR'
      `);
      console.log(`   ✅ Updated ${tiktokResult.rows.length} TikTok bookings\n`);
    } else {
      console.log("   ✅ All TikTok bookings already assigned to RIEMAR\n");
    }

    // Fix Airbnb bookings
    console.log("2️⃣ Checking Airbnb bookings...");
    const airbnbResult = await db.execute(sqlTag`
      SELECT id, guest_name, booking_source, check_in_date_key
      FROM bookings 
      WHERE booking_platform = 'Airbnb'
        AND booking_source != 'SIR JAMES'
      ORDER BY check_in_date_key DESC
    `);

    if (airbnbResult.rows.length > 0) {
      console.log(`   Found ${airbnbResult.rows.length} Airbnb bookings not assigned to SIR JAMES:`);
      airbnbResult.rows.forEach((b) => {
        console.log(`      • ${b.guest_name} (${b.check_in_date_key}) - Currently: ${b.booking_source || 'NULL'}`);
      });

      console.log(`\n   Updating ${airbnbResult.rows.length} Airbnb bookings to SIR JAMES...`);
      const updateAirbnb = await db.execute(sqlTag`
        UPDATE bookings 
        SET booking_source = 'SIR JAMES'
        WHERE booking_platform = 'Airbnb'
          AND booking_source != 'SIR JAMES'
      `);
      console.log(`   ✅ Updated ${airbnbResult.rows.length} Airbnb bookings\n`);
    } else {
      console.log("   ✅ All Airbnb bookings already assigned to SIR JAMES\n");
    }

    // Verify
    console.log("3️⃣ Verifying...\n");
    
    const tiktokCount = await db.execute(sqlTag`
      SELECT COUNT(*) as count FROM bookings WHERE booking_platform = 'TikTok'
    `);
    const tiktokRiemar = await db.execute(sqlTag`
      SELECT COUNT(*) as count FROM bookings WHERE booking_platform = 'TikTok' AND booking_source = 'RIEMAR'
    `);
    
    const airbnbCount = await db.execute(sqlTag`
      SELECT COUNT(*) as count FROM bookings WHERE booking_platform = 'Airbnb'
    `);
    const airbnbJames = await db.execute(sqlTag`
      SELECT COUNT(*) as count FROM bookings WHERE booking_platform = 'Airbnb' AND booking_source = 'SIR JAMES'
    `);

    console.log("📊 Final Summary:");
    console.log(`   TikTok: ${tiktokRiemar.rows[0].count}/${tiktokCount.rows[0].count} assigned to RIEMAR ${tiktokRiemar.rows[0].count === tiktokCount.rows[0].count ? '✅' : '❌'}`);
    console.log(`   Airbnb: ${airbnbJames.rows[0].count}/${airbnbCount.rows[0].count} assigned to SIR JAMES ${airbnbJames.rows[0].count === airbnbCount.rows[0].count ? '✅' : '❌'}`);
    console.log("");

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

fixAllPlatformAssignments()
  .then(() => {
    console.log("✅ All done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
