import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const rp = await db.execute(sql`select id, name, role from receiver_persons order by name`);
  const p = await db.execute(sql`select id, name, type, balance from persons order by name`);
  const dp = await db.execute(
    sql`select coalesce(dp_received_by,'') as name, count(*)::int as c from bookings group by coalesce(dp_received_by,'') order by c desc, name`
  );
  const fp = await db.execute(
    sql`select coalesce(fp_received_by,'') as name, count(*)::int as c from bookings group by coalesce(fp_received_by,'') order by c desc, name`
  );

  console.log("receiver_persons");
  console.table(rp.rows);
  console.log("persons");
  console.table(p.rows);
  console.log("bookings.dp_received_by");
  console.table(dp.rows);
  console.log("bookings.fp_received_by");
  console.table(fp.rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
