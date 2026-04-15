import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { count } from "drizzle-orm";

async function getTotal() {
  try {
    const result = await db.select({ total: count() }).from(bookings);
    console.log(`Total bookings: ${result[0].total}`);
  } catch (error) {
    console.error("Error:", error);
  }
}

getTotal();
