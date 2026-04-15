import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings, paymentTransfers, persons, receiverPersons } from "@/lib/schema";
import { asc, desc, eq } from "drizzle-orm";
import { toYMD } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function findOrCreatePersonId(name: string, type: "sender" | "recipient") {
  const normalized = name.trim().toLowerCase();
  const existing = await db.select().from(persons).where(eq(persons.name, normalized));
  if (existing.length > 0) return existing[0].id;

  const created = await db
    .insert(persons)
    .values({ name: normalized, type, balance: "0.00" })
    .returning();
  return created[0].id;
}

async function recalculatePersonBalancesFromTransfers() {
  const [allPeople, allTransfers] = await Promise.all([
    db.select().from(persons),
    db.select().from(paymentTransfers),
  ]);

  const deltaByPersonId = new Map<number, number>();
  for (const person of allPeople) {
    deltaByPersonId.set(person.id, 0);
  }

  for (const transfer of allTransfers) {
    const amount = Number(transfer.amount || 0);
    deltaByPersonId.set(
      transfer.senderId,
      (deltaByPersonId.get(transfer.senderId) || 0) - amount
    );
    deltaByPersonId.set(
      transfer.recipientId,
      (deltaByPersonId.get(transfer.recipientId) || 0) + amount
    );
  }

  for (const person of allPeople) {
    await db
      .update(persons)
      .set({
        balance: (deltaByPersonId.get(person.id) || 0).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(persons.id, person.id));
  }
}

type ReceiverAccount = {
  name: string;
  role: "employee" | "host";
  bookingReceived: number;
  incomingTransfers: number;
  outgoingTransfers: number;
  availableBalance: number;
};

function normalizeName(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeToDateOnly(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function isWithinRange(value: string | Date | null | undefined, start?: Date, end?: Date): boolean {
  if (!start && !end) return true;
  const date = normalizeToDateOnly(value);
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

async function buildReceiverAccountsSnapshot(startDate?: Date, endDate?: Date) {
  const [configuredReceivers, allBookings, allTransfers, allPersons] = await Promise.all([
    db
      .select({ name: receiverPersons.name, role: receiverPersons.role })
      .from(receiverPersons)
      .orderBy(asc(receiverPersons.sortOrder), asc(receiverPersons.id)),
    db
      .select({
        totalFee: bookings.totalFee,
        dpAmount: bookings.dpAmount,
        fpAmount: bookings.fpAmount,
        checkIn: bookings.checkIn,
        checkInDateKey: bookings.checkInDateKey,
        dpReceivedBy: bookings.dpReceivedBy,
        fpReceivedBy: bookings.fpReceivedBy,
      })
      .from(bookings),
    db.select().from(paymentTransfers),
    db.select().from(persons),
  ]);

  const personMap = new Map(allPersons.map((p) => [p.id, normalizeName(p.name)]));
  const accountMap = new Map<string, ReceiverAccount>();

  for (const receiver of configuredReceivers) {
    const key = normalizeName(receiver.name);
    if (!key || accountMap.has(key)) continue;
    accountMap.set(key, {
      name: receiver.name,
      role: receiver.role === "host" ? "host" : "employee",
      bookingReceived: 0,
      incomingTransfers: 0,
      outgoingTransfers: 0,
      availableBalance: 0,
    });
  }

  const addBookingReceipt = (name: string | null, amount: number) => {
    const key = normalizeName(name);
    if (!key || amount <= 0) return;
    const account = accountMap.get(key);
    if (!account) return;
    account.bookingReceived += amount;
    account.availableBalance += amount;
  };

  const ensureAccount = (name: string, role: "employee" | "host" = "employee") => {
    const key = normalizeName(name);
    if (!key) return null;
    const existing = accountMap.get(key);
    if (existing) return existing;

    const created: ReceiverAccount = {
      name,
      role,
      bookingReceived: 0,
      incomingTransfers: 0,
      outgoingTransfers: 0,
      availableBalance: 0,
    };
    accountMap.set(key, created);
    return created;
  };

  for (const booking of allBookings) {
    const bookingDateKey = booking.checkInDateKey || toYMD(booking.checkIn);
    if (!isWithinRange(bookingDateKey, startDate, endDate)) continue;

    const totalFee = Math.max(0, Number(booking.totalFee ?? 0));
    const dpRaw = Math.max(0, Number(booking.dpAmount ?? 0));
    const fpRaw = Math.max(0, Number(booking.fpAmount ?? 0));
    const collectedTotal = Math.min(totalFee, dpRaw + fpRaw);

    const dpCollected = Math.min(dpRaw, collectedTotal);
    const fpCollected = Math.min(fpRaw, Math.max(0, collectedTotal - dpCollected));

    const dpReceiver = String(booking.dpReceivedBy ?? "").trim();
    const fpReceiver = String(booking.fpReceivedBy ?? "").trim();

    if (dpCollected > 0) {
      if (dpReceiver) {
        ensureAccount(dpReceiver);
        addBookingReceipt(dpReceiver, dpCollected);
      }
    }

    if (fpCollected > 0) {
      if (fpReceiver) {
        ensureAccount(fpReceiver);
        addBookingReceipt(fpReceiver, fpCollected);
      }
    }
  }

  for (const transfer of allTransfers) {
    const transferDate = transfer.transferDate ?? transfer.createdAt;
    if (!isWithinRange(transferDate, startDate, endDate)) continue;

    const amount = Number(transfer.amount ?? 0);
    if (amount <= 0) continue;

    const senderKey = personMap.get(transfer.senderId) ?? "";
    const recipientKey = personMap.get(transfer.recipientId) ?? "";

    const senderAccount = accountMap.get(senderKey);
    if (senderAccount) {
      senderAccount.outgoingTransfers += amount;
      senderAccount.availableBalance -= amount;
    }

    const recipientAccount = accountMap.get(recipientKey);
    if (recipientAccount) {
      recipientAccount.incomingTransfers += amount;
      recipientAccount.availableBalance += amount;
    }
  }

  const accounts = Array.from(accountMap.values())
    .filter((account) => normalizeName(account.name) !== "unassigned")
    .map((account) => ({
      ...account,
      bookingReceived: roundCurrency(account.bookingReceived),
      incomingTransfers: roundCurrency(account.incomingTransfers),
      outgoingTransfers: roundCurrency(account.outgoingTransfers),
      availableBalance: roundCurrency(account.availableBalance),
    }));

  return {
    accountByName: new Map(accounts.map((account) => [normalizeName(account.name), account])),
    accounts,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const recipientId = searchParams.get("recipientId");
    const senderId = searchParams.get("senderId");
    const weeklyDateParam = searchParams.get("weeklyDate");
    const monthlyDateParam = searchParams.get("monthlyDate");
    const scope = searchParams.get("scope") || "all";
    const includeAccounts = searchParams.get("includeAccounts") === "1";
    const accountScope = searchParams.get("accountScope") || "all";
    const accountMonth = searchParams.get("accountMonth");

    const weeklyAnchor = weeklyDateParam
      ? new Date(`${weeklyDateParam}T12:00:00`)
      : new Date();
    const anchor = Number.isNaN(weeklyAnchor.getTime()) ? new Date() : weeklyAnchor;
    const weekStart = new Date(anchor);
    weekStart.setDate(anchor.getDate() - anchor.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const monthAnchor = monthlyDateParam
      ? new Date(`${monthlyDateParam}-01T12:00:00`)
      : new Date();
    const monthBase = Number.isNaN(monthAnchor.getTime()) ? new Date() : monthAnchor;
    const monthStart = new Date(monthBase.getFullYear(), monthBase.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(monthBase.getFullYear(), monthBase.getMonth() + 1, 0, 23, 59, 59, 999);

    let query = db.select().from(paymentTransfers);

    if (recipientId) {
      query = query.where(eq(paymentTransfers.recipientId, parseInt(recipientId))) as any;
    }

    if (senderId) {
      query = query.where(eq(paymentTransfers.senderId, parseInt(senderId))) as any;
    }

    const transfers = await query.orderBy(desc(paymentTransfers.transferDate));
    const allPersons = await db.select().from(persons);
    const personMap = new Map(allPersons.map((p) => [p.id, p.name]));

    const enriched = transfers
      .map((t) => ({
        ...t,
        sender: personMap.get(t.senderId) ?? "",
        recipient: personMap.get(t.recipientId) ?? "",
      }))
      .filter((t) => {
        const d = new Date(t.transferDate ?? t.createdAt ?? new Date());
        if (scope === "week") return d >= weekStart && d <= weekEnd;
        if (scope === "month") return d >= monthStart && d <= monthEnd;
        return true;
      });

    if (!includeAccounts) {
      return NextResponse.json(enriched, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    }

    let accountStartDate: Date | undefined;
    let accountEndDate: Date | undefined;

    if (accountScope === "month" && accountMonth && /^\d{4}-\d{2}$/.test(accountMonth)) {
      const [yearStr, monthStr] = accountMonth.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);
      if (!Number.isNaN(year) && !Number.isNaN(month) && month >= 1 && month <= 12) {
        accountStartDate = new Date(year, month - 1, 1);
        accountStartDate.setHours(0, 0, 0, 0);
        accountEndDate = new Date(year, month, 0);
        accountEndDate.setHours(0, 0, 0, 0);
      }
    }

    const { accounts } = await buildReceiverAccountsSnapshot(accountStartDate, accountEndDate);

    return NextResponse.json({ transfers: enriched, accounts }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("GET /api/payment-transfers:", error);
    return NextResponse.json(
      { error: "Failed to fetch transfers" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sender,
      recipient,
      senderId,
      recipientId,
      amount,
      transferDate,
      sourceUnit,
      sourceWeekStart,
      reason,
      paymentMethod,
      status,
    } = body;

    const senderName = String(sender ?? "").trim();
    const recipientName = String(recipient ?? "").trim();

    if ((!senderName && !senderId) || (!recipientName && !recipientId) || !amount || !transferDate) {
      return NextResponse.json(
        { error: "Missing required fields: sender, recipient, amount, transferDate" },
        { status: 400 }
      );
    }

    const amountNumber = Number(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    const amountStr = amountNumber.toFixed(2);

    const resolvedSenderId = senderName
      ? await findOrCreatePersonId(senderName, "sender")
      : parseInt(String(senderId), 10);
    const resolvedRecipientId = recipientName
      ? await findOrCreatePersonId(recipientName, "recipient")
      : parseInt(String(recipientId), 10);

    if (resolvedSenderId === resolvedRecipientId) {
      return NextResponse.json(
        { error: "Sender and recipient must be different" },
        { status: 400 }
      );
    }

    const { accountByName } = await buildReceiverAccountsSnapshot();
    const senderAccount = accountByName.get(normalizeName(senderName));
    if (!senderAccount) {
      return NextResponse.json(
        { error: "Sender is not configured in Settings > Receiver Persons" },
        { status: 400 }
      );
    }

    if (amountNumber > senderAccount.availableBalance) {
      return NextResponse.json(
        {
          error: `Insufficient balance. ${senderName} has ${senderAccount.availableBalance.toFixed(2)} available.`,
        },
        { status: 400 }
      );
    }

    const sendP = await db.select().from(persons).where(eq(persons.id, resolvedSenderId));
    const recP = await db.select().from(persons).where(eq(persons.id, resolvedRecipientId));

    if (!sendP.length || !recP.length) {
      return NextResponse.json(
        { error: "Sender or recipient not found" },
        { status: 404 }
      );
    }

    const newTransfer = await db
      .insert(paymentTransfers)
      .values({
        senderId: resolvedSenderId,
        recipientId: resolvedRecipientId,
        amount: amountStr,
        transferDate: new Date(transferDate),
        sourceUnit: sourceUnit ? String(sourceUnit) : null,
        sourceWeekStart: sourceWeekStart ? new Date(sourceWeekStart) : null,
        reason: reason || null,
        paymentMethod: paymentMethod || null,
        status: status || "transferred",
      })
      .returning();

    const transfer = newTransfer[0];

    await recalculatePersonBalancesFromTransfers();

    return NextResponse.json(
      {
        ...transfer,
        sender: sendP[0].name,
        recipient: recP[0].name,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/payment-transfers:", error);
    return NextResponse.json(
      { error: "Failed to create transfer" },
      { status: 500 }
    );
  }
}
