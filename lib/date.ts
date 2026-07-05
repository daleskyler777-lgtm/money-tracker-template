const PACIFIC_TZ = "America/Los_Angeles";

/** Today's date in Pacific time as YYYY-MM-DD (en-CA locale formats ISO-style). */
export function todayPacific(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Current month in Pacific time as YYYY-MM. */
export function currentMonthPacific(): string {
  return todayPacific().slice(0, 7);
}

/** "2026-07" -> "July 2026" */
export function monthLabel(yyyyMm: string): string {
  const d = new Date(`${yyyyMm}-15T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function isValidDateString(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
