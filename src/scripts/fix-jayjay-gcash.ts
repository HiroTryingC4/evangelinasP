import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

async function fixJayjayGcash() {
  try {
    console.log("Finding Samantha Baquiran (May 23, 2026)...");
    const samanthaResult = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.guestName, "Samantha Baquiran"),
          eq(bookings.checkInDateKey, "2026-05-23")
        )
      );

    if (samanthaResult.length > 0) {
      const samantha = samanthaResult[0];
      console.log(
        `Found Samantha (ID: ${samantha.id}): fpReceivedBy=${samantha.fpReceivedBy}, fpMethod=${samantha.fpMethod}, fpAmount=${samantha.fpAmount}`
      );

      await db
        .update(bookings)
        .set({ fpReceivedBy: "JAYJAY", updatedAt: new Date() })
        .where(eq(bookings.id, samantha.id));

      console.log("✓ Updated Samantha to JAYJAY");
    } else {
      console.log("⚠ Samantha Baquiran not found for 2026-05-23");
    }

    console.log("\nFinding Nadelle Hazel L. Maglisa (May 24, 2026)...");
    const nadelleResult = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.guestName, "Nadelle Hazel L. Maglisa"),
          eq(bookings.checkInDateKey, "2026-05-24")
        )
      );

    if (nadelleResult.length > 0) {
      const nadelle = nadelleResult[0];
      console.log(
        `Found Nadelle (ID: ${nadelle.id}): fpReceivedBy=${nadelle.fpReceivedBy}, fpMethod=${nadelle.fpMethod}, fpAmount=${nadelle.fpAmount}`
      );

      if (nadelle.fpReceivedBy !== "JAYJAY") {
        await db
          .update(bookings)
          .set({ fpReceivedBy: "JAYJAY", updatedAt: new Date() })
          .where(eq(bookings.id, nadelle.id));

        console.log("✓ Updated Nadelle to JAYJAY");
      } else {
        console.log("✓ Nadelle already set to JAYJAY");
      }
    } else {
      console.log("⚠ Nadelle Hazel L. Maglisa not found for 2026-05-24");
    }

    // Verify the updates
    console.log("\n✓ Verifying JAYJAY GCash totals for May 17-24...");
    const jayjayGcashBookings = await db
      .select()
      .from(bookings)
      .where(eq(bookings.fpReceivedBy, "JAYJAY"));

    const jayjayGcashInRange = jayjayGcashBookings.filter(
      (b) =>
        (b.fpMethod?.toLowerCase() === "gcash" ||
          b.fpMethod?.toLowerCase() === "g-cash") &&
        b.checkInDateKey >= "2026-05-17" &&
        b.checkInDateKey <= "2026-05-24"
    );

    const total = jayjayGcashInRange.reduce(
      (sum, b) => sum + Number(b.fpAmount || 0),
      0
    );

    console.log("\nJAYJAY GCash bookings for May 17-24:");
    jayjayGcashInRange.forEach((b) => {
      console.log(`  - ${b.guestName} (${b.checkInDateKey}): ₱${Number(b.fpAmount).toLocaleString()}`);
    });

    console.log(`\n✓ JAYJAY GCash total: ₱${total.toLocaleString()}`);
    if (total >= 4900) {
      console.log("✓✓ SUCCESS! Matches or exceeds expected amount of ₱4,900!");
    } else {
      console.log(`⚠ Expected ₱4,900 but got ₱${total}`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixJayjayGcash();
