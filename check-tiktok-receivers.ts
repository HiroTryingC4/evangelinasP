import { config } from "dotenv";
config({ path: ".env.local" });

async function checkTikTok() {
  try {
    const { db } = await import("./src/lib/db");
    const { bookings } = await import("./src/lib/schema");
    
    const allBookings = await db.select().from(bookings);
    
    const tiktok = allBookings.filter(b => b.bookingPlatform === "TikTok");
    
    const may1723 = tiktok.filter(b => {
      const key = b.checkInDateKey || String(b.checkIn).substring(0, 10);
      return key >= "2026-05-17" && key <= "2026-05-23";
    });
    
    console.log("\nTikTok bookings May 17-23, 2026:");
    console.log(`Total: ${may1723.length}\n`);
    
    const byReceiver: any = {};
    may1723.forEach(b => {
      const receiver = b.dpReceivedBy || b.fpReceivedBy || "NOT SET";
      if (!byReceiver[receiver]) byReceiver[receiver] = [];
      byReceiver[receiver].push(b);
    });
    
    console.log("By receiver:");
    Object.entries(byReceiver).forEach(([receiver, guests]: any) => {
      console.log(`\n  ${receiver}: ${guests.length}`);
      guests.slice(0, 5).forEach((g: any) => {
        console.log(`    - ${g.guestName} (Unit ${g.unit})`);
      });
      if (guests.length > 5) {
        console.log(`    ... and ${guests.length - 5} more`);
      }
    });
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

checkTikTok();
