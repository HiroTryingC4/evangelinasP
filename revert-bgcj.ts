import { config } from "dotenv";
config({ path: ".env.local" });

async function revertAndRename() {
  try {
    const { db } = await import("./src/lib/db");
    const { bookings } = await import("./src/lib/schema");
    
    console.log("Reverting Business Gcash James back to RIEMAR...\n");
    
    // Get all bookings where Business Gcash James is the receiver
    const allBookings = await db.select().from(bookings);
    const bgcJamesBookings = allBookings.filter(b => 
      b.dpReceivedBy === "Business Gcash James" || b.fpReceivedBy === "Business Gcash James"
    );
    
    console.log(`Found ${bgcJamesBookings.length} bookings to revert\n`);
    
    // Update them back to RIEMAR
    const { eq } = await import("drizzle-orm");
    for (const booking of bgcJamesBookings) {
      await db
        .update(bookings)
        .set({
          dpReceivedBy: booking.dpReceivedBy === "Business Gcash James" ? "RIEMAR" : booking.dpReceivedBy,
          fpReceivedBy: booking.fpReceivedBy === "Business Gcash James" ? "RIEMAR" : booking.fpReceivedBy,
        })
        .where(eq(bookings.id, booking.id));
    }
    
    console.log(`✅ Reverted to RIEMAR`);
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

revertAndRename();
