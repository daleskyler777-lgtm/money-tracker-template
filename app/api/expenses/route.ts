import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { isValidDateString } from "@/lib/date";
import { CATEGORIES } from "@/lib/gemini";
import { getPeople, normalizePerson } from "@/lib/people";
import { appendExpense } from "@/lib/sheets";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!(await isAuthed())) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (!isValidDateString(body.date)) {
      return NextResponse.json({ error: "Date must be YYYY-MM-DD." }, { status: 400 });
    }
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
    }
    const defaultPerson = getPeople()[0];
    const category =
      typeof body.category === "string" &&
      (CATEGORIES as readonly string[]).includes(body.category.toLowerCase())
        ? body.category.toLowerCase()
        : "other";

    const expense = {
      date: body.date,
      person: normalizePerson(body.person, defaultPerson),
      amount: Math.round(amount * 100) / 100,
      merchant: typeof body.merchant === "string" ? body.merchant.trim().slice(0, 100) : "",
      category,
      notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 300) : "",
    };

    await appendExpense(expense);
    return NextResponse.json({ ok: true, expense });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
