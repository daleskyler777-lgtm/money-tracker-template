import { isValidDateString, todayPacific } from "./date";

export const CATEGORIES = [
  "groceries",
  "dining",
  "gas",
  "household",
  "entertainment",
  "health",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface ParsedExpense {
  date: string;
  person: string;
  amount: number;
  merchant: string;
  category: Category;
  notes: string;
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function model(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY environment variable is not set.");
  return key;
}

function buildPrompt(logger: string, people: string[], today: string): string {
  return `You parse expenses for a shared household expense tracker.
Today's date is ${today} (Pacific time).
The people who share this tracker are: ${people.join(", ")}.
The person logging this expense is "${logger}".

Extract a single expense as JSON with these fields:
- "date": the expense date as YYYY-MM-DD. Resolve relative dates like "yesterday" or "last Friday" against today's date. If no date is mentioned, use today's date.
- "person": who paid — must be exactly one of the names listed above. Use "${logger}" unless the text clearly names someone else in that list as the payer.
- "amount": the total amount paid as a plain number (e.g. 43.20), no currency symbols.
- "merchant": the store or vendor name, nicely capitalized ("costco" -> "Costco"). Empty string if unknown.
- "category": exactly one of: groceries, dining, gas, household, entertainment, health, other. Infer the most likely category — coffee shops, restaurants, and takeout are "dining"; supermarkets are "groceries"; fuel stations are "gas"; pharmacies, doctors, and gyms are "health"; cleaning supplies, furniture, and repairs are "household". Use "other" only when nothing fits.
- "notes": any leftover useful detail (items bought, occasion, context). Empty string if none.`;
}

const RECEIPT_SUFFIX = `

Parse the attached receipt photo. Use the final total (after tax) as the amount, the store name as the merchant, and the purchase date printed on the receipt (if visible) as the date. Summarize notable items in "notes".`;

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

async function callGemini(parts: GeminiPart[], fallbackPerson: string): Promise<ParsedExpense> {
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING", description: "YYYY-MM-DD" },
          person: { type: "STRING" },
          amount: { type: "NUMBER" },
          merchant: { type: "STRING" },
          category: { type: "STRING", enum: [...CATEGORIES] },
          notes: { type: "STRING" },
        },
        required: ["date", "person", "amount", "merchant", "category", "notes"],
      },
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await fetch(`${GEMINI_BASE}/${model()}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 400);
    if (res.status === 429) {
      throw new Error("Gemini free-tier rate limit hit — wait a minute and try again.");
    }
    throw new Error(`Gemini API error ${res.status}: ${detail}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("Gemini returned an empty response — try rephrasing.");

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Could not parse Gemini's response as JSON — try rephrasing.");
  }
  return sanitize(raw, fallbackPerson);
}

function sanitize(raw: Record<string, unknown>, fallbackPerson: string): ParsedExpense {
  const amountNum = Number(raw.amount);
  const category =
    typeof raw.category === "string" &&
    (CATEGORIES as readonly string[]).includes(raw.category.toLowerCase())
      ? (raw.category.toLowerCase() as Category)
      : "other";
  return {
    date: isValidDateString(raw.date) ? raw.date : todayPacific(),
    person:
      typeof raw.person === "string" && raw.person.trim() ? raw.person.trim() : fallbackPerson,
    amount: Number.isFinite(amountNum) && amountNum > 0 ? Math.round(amountNum * 100) / 100 : 0,
    merchant: typeof raw.merchant === "string" ? raw.merchant.trim().slice(0, 100) : "",
    category,
    notes: typeof raw.notes === "string" ? raw.notes.trim().slice(0, 300) : "",
  };
}

export async function parseExpenseText(
  text: string,
  person: string,
  people: string[]
): Promise<ParsedExpense> {
  const prompt = `${buildPrompt(person, people, todayPacific())}

Expense description: """${text}"""`;
  return callGemini([{ text: prompt }], person);
}

export async function parseExpenseImage(
  base64: string,
  mimeType: string,
  person: string,
  people: string[]
): Promise<ParsedExpense> {
  const prompt = buildPrompt(person, people, todayPacific()) + RECEIPT_SUFFIX;
  return callGemini(
    [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }],
    person
  );
}
