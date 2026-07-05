import { NextResponse } from "next/server";
import { checkPin, isAuthed, sessionValue, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (await isAuthed()) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { pin?: unknown };
    if (!checkPin(body.pin)) {
      return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, sessionValue(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
