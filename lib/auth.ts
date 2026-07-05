import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "mt_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function hashPin(pin: string): string {
  return createHash("sha256").update(`money-tracker:v1:${pin}`).digest("hex");
}

function expectedSessionValue(): string {
  const pin = process.env.APP_PIN;
  if (!pin) throw new Error("APP_PIN environment variable is not set.");
  return hashPin(pin);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function checkPin(pin: unknown): boolean {
  if (typeof pin !== "string" || pin.length === 0 || pin.length > 128) return false;
  return safeEqual(hashPin(pin), expectedSessionValue());
}

/** Value stored in the session cookie after a correct PIN entry. */
export function sessionValue(): string {
  return expectedSessionValue();
}

export async function isAuthed(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return false;
  try {
    return safeEqual(value, expectedSessionValue());
  } catch {
    return false;
  }
}
