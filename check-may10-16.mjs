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

async function checkMay10to16() {
  console.log("\n📊 Checking May 10-16, 2026 bookings...\n");

  try {
    // Get all TikTok bookings for this week
    const tiktokResult = await db.execute(sqlTag`
      SELECT id, guest_name, booking_source, booking_platform, check_in_date_key
      FROM bookings 
      WHERE booking_platform = 'TikTok'
        AND check_in_date_key >= '2026-05-10'
        AND check_in_date_key <= '2026-05-16'
      ORDER BY check_in_date_key, guest_name
    `);

    console.log(`🎵 TikTok bookings: ${tiktokResult.rows.length} total\n`);

    // Group by booking_source
    const bySource = {};
    tiktokResult.rows.forEach((b) => {
      const source = b.booking_source || "NULL";
      if (!bySource[source]) bySource[source] = [];
      bySource[source].push(b);
    });

    console.log("Breakdown by booking source:");
    Object.entries(bySource).forEach(([source, bookings]) => {
      console.log(`   ${source}: ${bookings.length} bookings`);
    });
    console.log("");

    // Show the ones NOT assigned to RIEMAR
    const notRiemar = tiktokResult.rows.filter((b) => b.booking_source !== "RIEMAR");
    if (notRiemar.length > 0) {
      console.log(`⚠️  ${notRiemar.length} TikTok bookings NOT assigned to RIEMAR:\n`);
      notRiemar.forEach((b) => {
        console.log(`   ID ${b.id}: ${b.guest_name} (${b.check_in_date_key}) - Source: ${b.booking_source || "NULL"}`);
      });
      console.log("");
    } else {
      console.log("✅ All TikTok bookings are assigned to RIEMAR!\n");
    }

    // Get all Airbnb bookings for this week
    const airbnbResult = await db.execute(sqlTag`
      SELECT id, guest_name, booking_source, booking_platform, check_in_date_key
      FROM bookings 
      WHERE booking_platform = 'Airbnb'
        AND check_in_date_key >= '2026-05-10'
        AND check_in_date_key <= '2026-05-16'
      ORDER BY check_in_date_key, guest_name
    `);

    console.log(`🏠 Airbnb bookings: ${airbnbResult.rows.length} total\n`);

    // Group by booking_source
    const airbnbBySource = {};
    airbnbResult.rows.forEach((b) => {
      const source = b.booking_source || "NULL";
      if (!airbnbBySource[source]) airbnbBySource[source] = [];
      airbnbBySource[source].push(b);
    });

    console.log("Breakdown by booking source:");
    Object.entries(airbnbBySource).forEach(([source, bookings]) => {
      console.log(`   ${source}: ${bookings.length} bookings`);
    });
    console.log("");

    // Show the ones NOT assigned to SIR JAMES
    const notJames = airbnbResult.rows.filter((b) => b.booking_source !== "SIR JAMES");
    if (notJames.length > 0) {
      console.log(`⚠️  ${notJames.length} Airbnb bookings NOT assigned to SIR JAMES:\n`);
      notJames.forEach((b) => {
        console.log(`   ID ${b.id}: ${b.guest_name} (${b.check_in_date_key}) - Source: ${b.booking_source || "NULL"}`);
      });
      console.log("");
    } else {
      console.log("✅ All Airbnb bookings are assigned to SIR JAMES!\n");
    }

    console.log("📋 Summary:");
    console.log(`   TikTok: ${tiktokResult.rows.length} total, ${tiktokResult.rows.filter(b => b.booking_source === "RIEMAR").length} assigned to RIEMAR`);
    console.log(`   Airbnb: ${airbnbResult.rows.length} total, ${airbnbResult.rows.filter(b => b.booking_source === "SIR JAMES").length} assigned to SIR JAMES`);
    console.log("");

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

checkMay10to16()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
