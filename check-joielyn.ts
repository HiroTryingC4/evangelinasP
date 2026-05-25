import { config } from "dotenv";
config({ path: ".env.local" });

async function checkJoielyn() {
  try {
    const { db } = await import("./src/lib/db");
    const { bookings } = await import("./src/lib/schema");
    
    const allBookings = await db.select().from(bookings);
    
    const joielyn = allBookings.filter(b => b.guestName.toLowerCase().includes("joielyn"));
    
    console.log(`Found ${joielyn.length} bookings with Joielyn:\n`);
    joielyn.forEach(b => {
      console.log(`${b.id}. ${b.guestName} - Unit ${b.unit}`);
      console.log(`   Platform: ${b.bookingPlatform}, dpReceivedBy: ${b.dpReceivedBy}, fpReceivedBy: ${b.fpReceivedBy}`);
      if (b.bookingPlatform === "TikTok") {
        const key = b.checkInDateKey || String(b.checkIn).substring(0, 10);
        if (key >= "2026-05-17" && key <= "2026-05-23") {
          console.log(`   ✓ In May 17-23 date range`);
        }
      }
      console.log();
    });
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

checkJoielyn();
