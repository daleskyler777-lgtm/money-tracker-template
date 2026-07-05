# 💸 Build your own Money Tracker

A shared expense tracker for you and the people you add. You type an expense in
plain English (*"$43 Costco groceries"*) or snap a photo of a receipt — an AI reads
it, and it gets saved as a row in a Google Sheet you all share. There's a "This
Month" summary showing totals per person and per category.

This guide takes you from nothing to a live app on the internet **without writing
a single line of code and without installing anything** — and it works entirely
from your phone. Everything is done through websites and one tap of a "Deploy"
button.

> 📖 **Prefer a nicer, click-through version?** Open **`START-HERE.html`** (in this
> same folder, or [view it online](https://raw.githack.com/daleskyler777-lgtm/money-tracker-template/main/START-HERE.html))
> — it has the exact same steps, copy buttons, and diagrams. This README has all
> the same content in case you're reading on GitHub.

---

## What you'll end up with

```
        ┌─────────────────────────────┐
        │        💸 Money Tracker      │
        │      [ Alex ]   Sam          │   ← pick who's paying
        │  ┌───────────────────────┐   │
        │  │ "$43 Costco groceries"│   │   ← type it, or tap 📷 for a receipt
        │  └───────────────────────┘   │
        │   [ 📷 Receipt ] [ Log it ]  │
        │                             │
        │  This Month — $95.27        │   ← live totals
        │   Alex   $43.27             │
        │   Sam    $52.00             │
        └─────────────────────────────┘
```

A private web app, on its own link, that you can add to your phone's home screen so
it feels like a real app. Only people who know your PIN can open it.

---

## How it works (in plain English)

When you type an expense and tap the button, here's the journey:

```
  Your phone ──▶ Your app (hosted free on Vercel)
                     │
                     ├──▶ Google Gemini AI  ──▶ reads your words/photo,
                     │                           returns { amount, store, category… }
                     │
                     └──▶ Google Sheets     ──▶ adds one row to your shared sheet
                     │
  Your phone ◀───────┘  shows a confirmation + updated monthly totals
```

You never see any of this — you just type and tap. But it explains the accounts
you're about to create: one gives the app an **AI brain** (Gemini), one gives it a
**notebook to write in** (Google Sheets), and the last one gets it **online**
(Vercel, which creates your GitHub copy for you automatically).

---

## Before you start — the honest details

| | |
|---|---|
| ⏱️ **Time** | About 20–30 minutes, mostly clicking through account setup. |
| 💵 **Cost** | **Free.** Every service here has a free tier that's way more than enough for two people logging expenses. No credit card required. |
| 🔒 **Security** | The app is protected by a **shared PIN**. That's fine for a personal expense app between two people, but it is *convenience-level* security — don't reuse an important PIN, and don't store anything sensitive. |
| 🤖 **Privacy** | Your expense text and receipt photos are sent to Google's Gemini AI to be read. On the **free tier, Google may use that data to improve their models.** Receipt photos are never saved by the app itself — they're read once and discarded. |

### Accounts you'll need (all free)

- [ ] A **Google account** (you almost certainly have one — Gmail counts). This single account covers the AI key, the sheet, and the robot login.
- [ ] A **GitHub account** — sign up at [github.com](https://github.com) (you can do this from your phone's browser). You don't need to know Git or upload any files — Vercel creates your copy of the code for you in Step 5.
- [ ] A **Vercel account** — the free host that puts your app online. Sign up at [vercel.com](https://vercel.com) using your GitHub account (one tap).

Create the GitHub and Vercel accounts now if you don't have them, then come back.

> 💡 **The short version:** collect four things below (a Sheet ID, an AI key, and two values from a "robot" account), then tap one **Deploy** button in Step 5 and paste them in. That's the whole setup.

---

## Step 1 — Create your Google Sheet

This is where your expenses will be stored.

1. Go to **[sheets.new](https://sheets.new)** (this instantly creates a new blank
   Google Sheet). Works fine in your phone's browser.
2. Give it a name — tap **"Untitled spreadsheet"** at the top-left and type
   something like `Expenses`.
3. **Add the header row.** Tap the very first cell, **A1**, and paste this exact
   line (it will automatically spread across the first six cells):

   ```
   Date	Person	Amount	Merchant	Category	Notes
   ```

   > 💡 The gaps between the words are **Tab** characters. Copy the whole line above
   > and paste it into cell **A1** — Google Sheets fills A1 through F1 for you. If it
   > all lands in one cell, undo and instead type each word into cells
   > A1, B1, C1, D1, E1, F1 with **Tab** between them.

   Your top row should read: **Date | Person | Amount | Merchant | Category | Notes**

4. **Copy your Sheet ID.** Look at the web address (URL) at the top of your browser.
   It looks like this — the long jumble in the middle is your **Sheet ID**:

   ```
   https://docs.google.com/spreadsheets/d/1AbCd...LongJumble...xyz/edit#gid=0
                                          └──────────── this part ────────────┘
   ```

   Select just that middle part (between `/d/` and `/edit`) and copy it. Paste it into
   a notes app for now — you'll need it in Step 5. We'll call it **`GOOGLE_SHEET_ID`**.

Leave this sheet open (or its tab open); you'll share it in Step 4.

---

## Step 2 — Get a free AI key (Google Gemini)

This gives your app its brain for reading expenses.

1. Go to **[aistudio.google.com](https://aistudio.google.com)** and sign in with your
   Google account.
2. Tap **"Get API key"** (a key icon, in the left-hand menu — on a phone this may be
   under a ☰ menu button first).
3. Tap **"Create API key"**, then choose **"Create API key in new project"**.
4. A long key appears — it may start with **`AIza`** or **`AQ.`** (both are valid
   formats). Tap **Copy** and paste it into your notes app. We'll call it
   **`GEMINI_API_KEY`**.

> 💡 Treat this key like a password — anyone with it can use your free AI quota.

---

## Step 3 — Create a "robot" account for the sheet (Google Cloud)

Your app can't log into Google as *you*. Instead it uses a **service account** — a
robot identity that's allowed to write to just your one sheet. This is the most
technical-looking step, but it's only tapping. Follow along exactly.

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)** and sign in.
   - If it asks you to agree to terms, do so. You will **not** be charged and don't
     need to start any free trial.
2. **Select the right project.** At the very top, next to "Google Cloud", there's a
   project name dropdown. Tap it and pick the project that was created in Step 2
   (it may be called something like *"Gemini API"* or *"My First Project"*). Any
   project works, but using the same one keeps things tidy.
3. **Turn on the Sheets API:**
   - In the search bar at the top, type **`Google Sheets API`** and tap the result.
   - Tap the blue **"Enable"** button. Wait a few seconds for it to finish.
4. **Create the service account:**
   - In the top search bar, type **`Service Accounts`** and tap the result (under
     "IAM & Admin").
   - Tap **"+ Create service account"** near the top.
   - **Service account name:** type `expense-bot`. Tap **"Create and continue"**.
   - It now asks to "Grant this service account access to project" — **skip this**.
     Tap **"Continue"**, then **"Done"**. (It needs no project roles; it gets
     access by being shared on your sheet in the next step.)
5. **Create its key file:**
   - You're back on the Service Accounts list. Tap the one you just made
     (`expense-bot@...`).
   - Tap the **"Keys"** tab near the top.
   - Tap **"Add key" → "Create new key"**.
   - Choose **JSON**, then tap **"Create"**.
   - A file downloads to your phone (something like
     `expense-bot-abc123.json`). **This file is like a password — keep it safe and
     delete it once you're done.**
6. **Open the downloaded file and copy two values out of it.** This is the fiddliest
   part on a phone, so here's the easiest way:
   - Tap the downloaded `.json` file (in your Downloads app, or the notification/
     download tray your browser shows). Choose **"Open with"** your browser
     (Chrome/Safari) or a plain-text/notes app — most phone browsers will just show
     you the raw text of the file.
   - **Select all the text** and copy the *whole file* into your notes app first.
     It's much easier to precisely select small pieces of text there than inside a
     cramped downloaded-file viewer.
   - From the pasted text in your notes app, copy out:
     - **`"client_email"`** — an address ending in `...iam.gserviceaccount.com`. We'll
       call this **`GOOGLE_SERVICE_ACCOUNT_EMAIL`**.
     - **`"private_key"`** — a long block starting with
       `-----BEGIN PRIVATE KEY-----`. Copy **everything between the quotation marks**,
       including the `BEGIN`/`END` lines. We'll call this **`GOOGLE_PRIVATE_KEY`**.
       It's fine that it's one very long line with `\n` in it — paste it exactly as
       it appears, quotes and all removed, `\n`'s kept.

### Where each value goes (keep this handy for Step 5)

```
  Downloaded JSON file                Environment variable (Step 5)
  ────────────────────                ─────────────────────────────
  "client_email":  ────────────────▶  GOOGLE_SERVICE_ACCOUNT_EMAIL
  "private_key":   ────────────────▶  GOOGLE_PRIVATE_KEY

  Google Sheet URL  ───────────────▶  GOOGLE_SHEET_ID   (from Step 1)
  Gemini API key    ───────────────▶  GEMINI_API_KEY    (from Step 2)
```

---

## Step 4 — Share your sheet with the robot

Right now the robot exists but can't see your sheet. Let's fix that. **This is the
single most-forgotten step — skip it and the app can't save anything.**

1. Go back to your Google Sheet from Step 1.
2. Tap the green **"Share"** button (top-right).
3. In the "Add people" box, paste the robot's email — the
   **`GOOGLE_SERVICE_ACCOUNT_EMAIL`** ending in `...iam.gserviceaccount.com`.
4. Make sure its role is set to **"Editor"** (not just Viewer).
5. **Uncheck "Notify people"** (the robot has no inbox).
6. Tap **"Share"** / **"Send"**.

Done. The robot can now write to your sheet.

---

## Step 5 — Deploy your app

This is the step that puts your app online — no code, no uploads, no separate
GitHub step. Tapping the button below asks Vercel to make you a personal copy of
this code on your own GitHub account *and* deploy it in one go.

Before you tap it, make sure you have your four values from Steps 1–3 handy
(paste them into your notes app if you haven't already):

- `GOOGLE_SHEET_ID`
- `GEMINI_API_KEY`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

Now tap:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdaleskyler777-lgtm%2Fmoney-tracker-template&env=APP_PIN%2CGEMINI_API_KEY%2CGOOGLE_SERVICE_ACCOUNT_EMAIL%2CGOOGLE_PRIVATE_KEY%2CGOOGLE_SHEET_ID%2CSHEET_NAME%2CPEOPLE&envDescription=Get%20these%20values%20from%20the%20setup%20guide%20in%20the%20README%20(Steps%201-3)&envLink=https%3A%2F%2Fgithub.com%2Fdaleskyler777-lgtm%2Fmoney-tracker-template%23environment-variables&project-name=money-tracker&repository-name=money-tracker)

The button copies this project's code: **[github.com/daleskyler777-lgtm/money-tracker-template](https://github.com/daleskyler777-lgtm/money-tracker-template)**

> 🐙 **Button not working, or want to look at the code first?** Open the repo above
> and tap the green **"Use this template"** button to make your own copy on GitHub,
> then import it at [vercel.com/new](https://vercel.com/new) and add the same
> variables from the table below.

1. **Sign in with GitHub** if asked (same account from "Before you start").
2. Vercel offers to create a new repository for your copy of the code — the name
   is prefilled, you can leave it as-is. Confirm it.
3. You'll land on a **"Configure Project"** screen with an **Environment Variables**
   section, already listing the names below. Tap each field and paste the matching
   value:

### Environment Variables

| Name | Value — where it comes from |
|---|---|
| `APP_PIN` | A number *you* pick, e.g. `2468`. This is the PIN you'll both type to open the app. |
| `GEMINI_API_KEY` | The key from **Step 2** (it may start with `AIza` or `AQ.`). |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | The `…iam.gserviceaccount.com` email from **Step 3**. |
| `GOOGLE_PRIVATE_KEY` | The long `-----BEGIN PRIVATE KEY-----…` block from **Step 3**. Paste it exactly as-is (it's fine if it's multiple lines, or one long line with `\n` in it). |
| `GOOGLE_SHEET_ID` | The long ID from your sheet's URL, **Step 1**. |
| `SHEET_NAME` | `Sheet1` (this is the tab name at the bottom-left of your sheet — leave it as `Sheet1` unless you renamed the tab). |
| `PEOPLE` | Everyone's names, separated by commas — e.g. `Alex,Sam` or `Alex,Sam,Jordan`. **Add as many people as you like.** The first name is the default selection. |

> 💡 You can leave out `GEMINI_MODEL` — the app defaults to `gemini-2.5-flash`, which
> is free and fast.

4. Once they're all filled in, tap the big **"Deploy"** button.
5. Wait 1–2 minutes while Vercel builds it. When it's done you'll see confetti 🎉 and a
   link like **`money-tracker-xxxx.vercel.app`**. Tap **"Continue to Dashboard"**,
   and your link is shown under **"Domains"**.

---

## Step 6 — Open it and share it

1. Open your `…vercel.app` link — on your computer or straight on your phone.
2. Type the **PIN** you chose (`APP_PIN`) and tap **Unlock**.
3. Tap your name at the top so entries are attributed to you (it's remembered on your
   device).
4. Try it: type `12 coffee` and tap **Log expense**. Check that a row appears in your
   Google Sheet, and the "This Month" total updates.
5. **Add it to your home screen** so it feels like an app:
   - **iPhone (Safari):** tap the Share icon → **"Add to Home Screen"**.
   - **Android (Chrome):** tap the ⋮ menu → **"Add to Home screen"**.
6. **Send the link and PIN** to the other person so they can do the same. They just tap
   *their* name once.

🎉 **You're done.** You built and shipped a real web app, entirely from your phone.

---

## Troubleshooting

If something's off, the app usually tells you what's wrong in a red box. Match it here:

| What you see | What it means & how to fix it |
|---|---|
| **"permission denied" / 403** when logging or loading totals | The sheet isn't shared with the robot. Redo **Step 4** — share the sheet with the `…iam.gserviceaccount.com` email as **Editor**. Also make sure the Sheets API is enabled (**Step 3.3**). |
| **"private key" / "doesn't look like a valid private key"** | The `GOOGLE_PRIVATE_KEY` got mangled. In Vercel → **Settings → Environment Variables**, edit it and re-paste the whole block from the JSON file, including the `-----BEGIN`/`END-----` lines. Then redeploy (see below). |
| **"Spreadsheet not found" / 404** | The `GOOGLE_SHEET_ID` is wrong. Recopy just the long middle part of the sheet URL (**Step 1.4**) into Vercel and redeploy. |
| **"rate limit" / 429** | You've hit Gemini's free per-minute limit. Wait a minute and try again. |
| **Totals say $0 or look empty** | Make sure your sheet's first row is the headers (**Step 1.3**) and your expenses are on the rows below. The summary only counts the **current month** (Pacific time). |
| **App shows "Alex / Sam" instead of your names** | You didn't set `PEOPLE` in Vercel, or misspelled it. Add/fix it (comma-separated names) and redeploy. |
| **Wrong PIN** even though it's right | Check `APP_PIN` in Vercel has no extra spaces. Env-var changes only take effect after a redeploy. |

### How to redeploy after changing an environment variable

In Vercel: open your project → **Deployments** tab → tap the **⋯** menu on the top
(most recent) deployment → **Redeploy**. Env-var changes only apply to new deployments.

---

## Frequently asked

**Is it really free?** Yes. Vercel's Hobby plan, Google Sheets, and Gemini's free tier
all cost nothing at this scale. None of the steps ask for a credit card.

**How many people can use it?** As many as you list in the `PEOPLE` variable — two,
three, or more. Everyone shares one link and PIN, and each person taps their own
name. To add someone later, edit `PEOPLE` in Vercel and redeploy.

**Can I just edit the sheet by hand?** Absolutely — add, fix, or delete rows directly in
Google Sheets and the app's totals update to match. Keep dates in the `YYYY-MM-DD`
format (or real date cells).

**Where are my receipt photos stored?** Nowhere. They're sent to the AI to be read, then
discarded. Only the resulting text (amount, store, etc.) is saved to your sheet.

---

## Advanced (optional) — run it on your own computer

*You do not need this for the steps above.* If you're comfortable with a terminal and
want to run it locally or auto-create the sheet headers with a script:

1. Tap **"Use this template"** on the [template repository](https://github.com/daleskyler777-lgtm/money-tracker-template),
   or clone your deployed copy from GitHub.
2. Install [Node.js](https://nodejs.org) (version 20 or newer).
3. In this folder, copy `.env.example` to a new file named `.env.local` and fill in the
   same values from Step 5.
4. Run `npm install`, then `npm run setup:sheet` (writes and formats the header row for
   you), then `npm run dev`, and open `http://localhost:3000`.

---

*Built with Next.js, Google Gemini, Google Sheets, and Vercel.*
