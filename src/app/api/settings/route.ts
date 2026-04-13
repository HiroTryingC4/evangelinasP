import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { persons, receiverPersons, unitConfigs } from "@/lib/schema";
import { STAFF, UNITS } from "@/lib/utils";

export const dynamic = "force-dynamic";

function normalizeUnitCode(value: string): string {
  return value.trim().replace(/^Unit\s*/i, "");
}

function sanitizeList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out = values
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  return Array.from(new Set(out));
}

function sanitizeUnits(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const unit = normalizeUnitCode(String(value ?? ""));
    if (!unit) continue;
    if (seen.has(unit)) continue;
    seen.add(unit);
    out.push(unit);
  }

  return out;
}

type ReceiverInput = { name: string; role: "employee" | "host" };

function sanitizeReceivers(values: unknown): ReceiverInput[] {
  if (!Array.isArray(values)) return [];

  const out: ReceiverInput[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    let name = "";
    let role: "employee" | "host" = "employee";

    if (typeof value === "string") {
      name = value.trim();
    } else if (value && typeof value === "object") {
      const v = value as { name?: unknown; role?: unknown };
      name = String(v.name ?? "").trim();
      role = String(v.role ?? "employee").toLowerCase() === "host" ? "host" : "employee";
    }

    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, role });
  }

  return out;
}

export async function GET() {
  try {
    const [units, receivers] = await Promise.all([
      db.select({ code: unitConfigs.code }).from(unitConfigs).orderBy(asc(unitConfigs.sortOrder), asc(unitConfigs.id)),
      db
        .select({ name: receiverPersons.name, role: receiverPersons.role })
        .from(receiverPersons)
        .orderBy(asc(receiverPersons.sortOrder), asc(receiverPersons.id)),
    ]);

    return NextResponse.json({
      units: units.length > 0 ? units.map((u) => u.code) : UNITS,
      receivers: receivers.length > 0 ? receivers.map((r) => r.name) : STAFF,
      receiverPersons: receivers.length > 0 ? receivers : STAFF.map((name) => ({ name, role: "employee" })),
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (e) {
    console.error("[GET /api/settings]", e);
    return NextResponse.json({ error: "Failed to fetch settings" }, {
      status: 500,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    const units = sanitizeUnits(body.units);
    const receivers = sanitizeReceivers(body.receivers);

    if (units.length === 0) {
      return NextResponse.json({ error: "At least one unit is required" }, { status: 400 });
    }
    if (receivers.length === 0) {
      return NextResponse.json({ error: "At least one receiver person is required" }, { status: 400 });
    }

    // Neon HTTP driver does not support db.transaction(),
    // so persist updates in sequence.
    await db.delete(unitConfigs);
    await db.delete(receiverPersons);

    await db.insert(unitConfigs).values(
      units.map((code, i) => ({ code, sortOrder: i }))
    );

    await db.insert(receiverPersons).values(
      receivers.map((person, i) => ({ name: person.name, role: person.role, sortOrder: i }))
    );

    // Keep `persons` in sync so newly added receivers are available
    // in transfer/payment database flows that read from this table.
    const existingPersons = await db.select({ name: persons.name }).from(persons);
    const existingSet = new Set(existingPersons.map((p) => String(p.name).trim().toLowerCase()));
    const personRows = receivers
      .map((person) => String(person.name).trim().toLowerCase())
      .filter((name) => name && !existingSet.has(name))
      .map((name) => ({ name, type: "recipient" as const, balance: "0" }));

    if (personRows.length > 0) {
      await db.insert(persons).values(personRows);
    }

    return NextResponse.json({
      units,
      receivers: receivers.map((r) => r.name),
      receiverPersons: receivers,
    });
  } catch (e) {
    console.error("[PUT /api/settings]", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: "Failed to save settings", detail: message }, { status: 500 });
  }
}
