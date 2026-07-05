import { JWT } from "google-auth-library";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

export interface ExpenseRow {
  date: string;
  person: string;
  amount: number;
  merchant: string;
  category: string;
  notes: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is not set.`);
  return value;
}

function sheetId(): string {
  return requiredEnv("GOOGLE_SHEET_ID");
}

function tabName(): string {
  return process.env.SHEET_NAME?.trim() || "Sheet1";
}

function client(): JWT {
  return new JWT({
    email: requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    // Vercel/env files often store the key with literal \n sequences
    key: requiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes: SCOPES,
  });
}

function friendlySheetsError(err: unknown): Error {
  const e = err as { response?: { status?: number; data?: unknown }; message?: string };
  const status = e.response?.status;
  if (e.message?.includes("DECODER") || e.message?.includes("PEM")) {
    return new Error(
      "GOOGLE_PRIVATE_KEY doesn't look like a valid private key — copy the full private_key value from the service account JSON file (including the BEGIN/END lines)."
    );
  }
  if (status === 403) {
    return new Error(
      "Google Sheets returned 403 (permission denied). Share the sheet with the service account email as an Editor, and make sure the Sheets API is enabled in your Google Cloud project."
    );
  }
  if (status === 404) {
    return new Error("Spreadsheet not found — double-check GOOGLE_SHEET_ID.");
  }
  if (status === 400) {
    return new Error(
      `Google Sheets rejected the request (400) — check that the "${tabName()}" tab exists (SHEET_NAME env var). Detail: ${JSON.stringify(e.response?.data).slice(0, 300)}`
    );
  }
  return new Error(`Google Sheets error: ${e.message ?? String(err)}`);
}

export async function appendExpense(expense: ExpenseRow): Promise<void> {
  const range = encodeURIComponent(`${tabName()}!A:F`);
  try {
    await client().request({
      url: `${SHEETS_BASE}/${sheetId()}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      method: "POST",
      data: {
        values: [
          [
            expense.date,
            expense.person,
            expense.amount,
            expense.merchant,
            expense.category,
            expense.notes,
          ],
        ],
      },
    });
  } catch (err) {
    throw friendlySheetsError(err);
  }
}

/** Convert a Google Sheets date serial number to YYYY-MM-DD (epoch: 1899-12-30). */
function serialToDate(n: number): string {
  const ms = Date.UTC(1899, 11, 30) + Math.round(n) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

export async function readExpenses(): Promise<ExpenseRow[]> {
  const range = encodeURIComponent(`${tabName()}!A2:F`);
  let rows: (string | number | boolean)[][];
  try {
    const res = await client().request<{ values?: (string | number | boolean)[][] }>({
      url: `${SHEETS_BASE}/${sheetId()}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`,
    });
    rows = res.data.values ?? [];
  } catch (err) {
    throw friendlySheetsError(err);
  }

  return rows
    .map((r) => {
      const rawDate = r[0];
      const date =
        typeof rawDate === "number" ? serialToDate(rawDate) : String(rawDate ?? "").trim();
      const amount = Number(r[2]);
      return {
        date,
        person: String(r[1] ?? "").trim(),
        amount: Number.isFinite(amount) ? amount : 0,
        merchant: String(r[3] ?? "").trim(),
        category: String(r[4] ?? "").trim().toLowerCase(),
        notes: String(r[5] ?? "").trim(),
      };
    })
    .filter((r) => r.date !== "" && r.amount > 0);
}
