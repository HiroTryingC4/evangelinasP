import { config } from "dotenv";

// Load environment variables FIRST before any other imports
config({ path: ".env.local" });

import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function addBookingPlatformColumn() {
  console.log("Adding booking_platform column to bookings table...");

  try {
    // Add the column
    await db.execute(sql`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS booking_platform TEXT
    `);

    console.log("✅ Column added successfully");

    // Migrate existing data based on booking_source
    // TikTok bookings came from TikTok platform
    await db.execute(sql`
      UPDATE bookings 
      SET booking_platform = 'TikTok'
      WHERE booking_source = 'RIEMAR' AND booking_platform IS NULL
    `);

    // Airbnb bookings came from Airbnb platform
    await db.execute(sql`
      UPDATE bookings 
      SET booking_platform = 'Airbnb'
      WHERE booking_source = 'SIR JAMES' AND booking_platform IS NULL
    `);

    // Others default to Direct
    await db.execute(sql`
      UPDATE bookings 
      SET booking_platform = 'Direct'
      WHERE booking_platform IS NULL
    `);

    console.log("✅ Migrated existing data");

    // Verify
    const result = await db.execute(sql`
      SELECT booking_platform, COUNT(*) as count
      FROM bookings
      GROUP BY booking_platform
      ORDER BY count DESC
    `);

    console.log("\nPlatform distribution:");
    result.rows.forEach((row: any) => {
      console.log(`  ${row.booking_platform}: ${row.count} bookings`);
    });

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

addBookingPlatformColumn()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });
