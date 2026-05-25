import { config } from "dotenv";
config({ path: ".env.local" });

async function fixTikTokReceivers() {
  try {
    const { db } = await import("./src/lib/db");
    const { bookings } = await import("./src/lib/schema");
    const { eq, and } = await import("drizzle-orm");
    
    // Bookings that need fixing: 
    // JAYJAY group: jayjay (1845), Angel Nicole Biado (1845), Penelope (1116)
    // SIR JAMES group: Kristel Mae Flores (1116), Joielyn Salazar (1118), Ajhay Morales Villacampa (1118)
    
    const namesToFix = [
      "jayjay",
      "Angel Nicole Biado", 
      "Penelope",
      "Kristel Mae Flores",
      "Joielyn Salazar",
      "Ajhay Morales Villacampa"
    ];
    
    console.log("Fixing TikTok bookings receiver from JAYJAY/SIR JAMES to RIEMAR...\n");
    
    let fixed = 0;
    
    for (const name of namesToFix) {
      // Get all bookings for this guest name
      const allBookings = await db.select().from(bookings);
      const targetBooking = allBookings.find(b => b.guestName.toLowerCase() === name.toLowerCase());
      
      if (targetBooking) {
        console.log(`Found: ${targetBooking.guestName} (${targetBooking.unit})`);
        console.log(`  Before: dpReceivedBy=${targetBooking.dpReceivedBy}, fpReceivedBy=${targetBooking.fpReceivedBy}`);
        
        // Update to RIEMAR
        await db
          .update(bookings)
          .set({
            dpReceivedBy: targetBooking.dpReceivedBy === "RIEMAR" ? targetBooking.dpReceivedBy : "RIEMAR",
            fpReceivedBy: targetBooking.fpReceivedBy === "RIEMAR" ? targetBooking.fpReceivedBy : "RIEMAR",
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, targetBooking.id));
        
        console.log(`  After:  dpReceivedBy=RIEMAR, fpReceivedBy=RIEMAR\n`);
        fixed++;
      } else {
        console.log(`❌ Not found: ${name}\n`);
      }
    }
    
    console.log(`✅ Fixed ${fixed} bookings`);
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

fixTikTokReceivers();
