import { db } from "@/lib/db";
import { persons } from "@/lib/schema";
import { eq } from "drizzle-orm";

async function seedPersons() {
  const defaultPersons = [
    { name: "riemar", type: "sender" },
    { name: "sir mike", type: "recipient" },
    { name: "james", type: "recipient" },
  ];

  for (const person of defaultPersons) {
    const existing = await db
      .select()
      .from(persons)
      .where(eq(persons.name, person.name));

    if (!existing.length) {
      await db
        .insert(persons)
        .values({
          name: person.name,
          type: person.type,
          balance: "0",
        });
      console.log(`✓ Created person: ${person.name}`);
    } else {
      console.log(`✓ Person already exists: ${person.name}`);
    }
  }

  console.log("Done seeding persons!");
}

seedPersons().catch(console.error);
