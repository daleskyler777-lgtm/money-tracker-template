import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { currentMonthPacific, monthLabel } from "@/lib/date";
import { getPeople } from "@/lib/people";
import { readExpenses } from "@/lib/sheets";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!(await isAuthed())) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const month = currentMonthPacific();
    const rows = (await readExpenses()).filter((r) => r.date.startsWith(month));

    const perPerson: Record<string, number> = {};
    for (const p of getPeople()) perPerson[p] = 0;
    const perCategory: Record<string, number> = {};
    let total = 0;

    for (const r of rows) {
      total += r.amount;
      perPerson[r.person] = (perPerson[r.person] ?? 0) + r.amount;
      const cat = r.category || "other";
      perCategory[cat] = (perCategory[cat] ?? 0) + r.amount;
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    for (const k of Object.keys(perPerson)) perPerson[k] = round(perPerson[k]);
    for (const k of Object.keys(perCategory)) perCategory[k] = round(perCategory[k]);

    return NextResponse.json({
      month,
      monthLabel: monthLabel(month),
      total: round(total),
      count: rows.length,
      perPerson,
      perCategory,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
