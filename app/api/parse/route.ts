import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { parseExpenseImage, parseExpenseText } from "@/lib/gemini";
import { getPeople, normalizePerson } from "@/lib/people";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    if (!(await isAuthed())) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const people = getPeople();
    const defaultPerson = people[0];
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const image = form.get("image");
      const person = normalizePerson(form.get("person"), defaultPerson);

      if (!(image instanceof File) || image.size === 0) {
        return NextResponse.json({ error: "No image received." }, { status: 400 });
      }
      if (image.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: "Image is too large (max 8 MB). Try a smaller photo." },
          { status: 400 }
        );
      }
      const mimeType = image.type || "image/jpeg";
      if (!mimeType.startsWith("image/")) {
        return NextResponse.json({ error: "File must be an image." }, { status: 400 });
      }

      const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
      // The photo lives only in memory for this request — parsed, then discarded.
      const expense = await parseExpenseImage(base64, mimeType, person, people);
      return NextResponse.json({ expense });
    }

    const body = (await req.json().catch(() => ({}))) as { text?: unknown; person?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Type an expense first." }, { status: 400 });
    }
    if (text.length > 1000) {
      return NextResponse.json({ error: "Text is too long (max 1000 chars)." }, { status: 400 });
    }
    const person = normalizePerson(body.person, defaultPerson);
    const expense = await parseExpenseText(text, person, people);
    return NextResponse.json({ expense });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
