// One-time setup: writes the header row to the shared Google Sheet and
// formats it (frozen + bold header, currency format on Amount, column widths).
//
// Usage:  npm run setup:sheet     (reads credentials from .env.local)

import { JWT } from "google-auth-library";

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const HEADERS = ["Date", "Person", "Amount", "Merchant", "Category", "Notes"];
const WIDTHS = [110, 110, 90, 180, 130, 280];

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`✖ Missing env var ${name}. Copy .env.example to .env.local and fill it in.`);
    process.exit(1);
  }
  return value;
}

const email = requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
const key = requiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
const spreadsheetId = requiredEnv("GOOGLE_SHEET_ID");
const tab = process.env.SHEET_NAME?.trim() || "Sheet1";

const client = new JWT({
  email,
  key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

async function main() {
  // 1. Fetch spreadsheet metadata; find (or create) the target tab.
  const meta = await client.request({
    url: `${BASE}/${spreadsheetId}?fields=properties(title),sheets(properties(sheetId,title))`,
  });
  const title = meta.data.properties.title;
  let sheet = meta.data.sheets.find((s) => s.properties.title === tab);

  if (!sheet) {
    console.log(`Tab "${tab}" not found — creating it…`);
    const res = await client.request({
      url: `${BASE}/${spreadsheetId}:batchUpdate`,
      method: "POST",
      data: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
    sheet = res.data.replies[0].addSheet;
  }
  const gridId = sheet.properties.sheetId;

  // 2. Write the header row.
  await client.request({
    url: `${BASE}/${spreadsheetId}/values/${encodeURIComponent(`${tab}!A1:F1`)}?valueInputOption=RAW`,
    method: "PUT",
    data: { values: [HEADERS] },
  });

  // 3. Formatting: freeze + bold row 1, currency format on Amount, column widths.
  await client.request({
    url: `${BASE}/${spreadsheetId}:batchUpdate`,
    method: "POST",
    data: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId: gridId, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
        {
          repeatCell: {
            range: { sheetId: gridId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: "userEnteredFormat.textFormat.bold",
          },
        },
        {
          repeatCell: {
            range: { sheetId: gridId, startRowIndex: 1, startColumnIndex: 2, endColumnIndex: 3 },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "CURRENCY", pattern: "$#,##0.00" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        },
        ...WIDTHS.map((pixelSize, i) => ({
          updateDimensionProperties: {
            range: { sheetId: gridId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
            properties: { pixelSize },
            fields: "pixelSize",
          },
        })),
      ],
    },
  });

  console.log(`✔ Sheet "${title}" → tab "${tab}" is ready.`);
  console.log(`  Headers: ${HEADERS.join(" | ")}`);
  console.log(`  https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
}

main().catch((err) => {
  const status = err.response?.status;
  if (status === 403) {
    console.error(
      `✖ Permission denied (403). Two things to check:\n` +
        `  1. Share the sheet with ${email} as an Editor.\n` +
        `  2. Enable the "Google Sheets API" in your Google Cloud project.`
    );
  } else if (status === 404) {
    console.error("✖ Spreadsheet not found (404) — double-check GOOGLE_SHEET_ID.");
  } else if (`${err.message}`.includes("DECODER") || `${err.message}`.includes("PEM")) {
    console.error(
      "✖ GOOGLE_PRIVATE_KEY doesn't look like a valid private key — copy the full private_key value from the service account JSON file (including the BEGIN/END lines)."
    );
  } else {
    console.error("✖ Setup failed:", err.response?.data ?? err.message);
  }
  process.exit(1);
});
