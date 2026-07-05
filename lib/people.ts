/**
 * The people sharing this tracker, configurable via env.
 * Prefer a single comma-separated PEOPLE list (e.g. "Alex,Sam,Jordan");
 * otherwise fall back to the legacy PERSON_1, PERSON_2, … variables.
 * The first name is the default selection for new visitors.
 */
export function getPeople(): string[] {
  const fromList = process.env.PEOPLE?.split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  if (fromList && fromList.length > 0) return dedupe(fromList);

  const numbered: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = process.env[`PERSON_${i}`]?.trim();
    if (name) numbered.push(name);
  }
  if (numbered.length > 0) return dedupe(numbered);

  return ["Alex", "Sam"];
}

/** Remove case-insensitive duplicate names, keeping the first spelling. */
function dedupe(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const key = n.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(n);
    }
  }
  return out;
}

/** Coerce arbitrary input to one of the configured people (case-insensitive). */
export function normalizePerson(input: unknown, fallback: string): string {
  if (typeof input === "string") {
    const t = input.trim().toLowerCase();
    const match = getPeople().find((p) => p.toLowerCase() === t);
    if (match) return match;
  }
  return fallback;
}
