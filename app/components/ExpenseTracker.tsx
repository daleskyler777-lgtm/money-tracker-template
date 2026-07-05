"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CATEGORIES = [
  "groceries",
  "dining",
  "gas",
  "household",
  "entertainment",
  "health",
  "other",
] as const;

interface ParsedExpense {
  date: string;
  person: string;
  amount: number;
  merchant: string;
  category: string;
  notes: string;
}

/** Draft under user review — amount kept as string for friendly editing. */
interface Draft {
  date: string;
  person: string;
  amount: string;
  merchant: string;
  category: string;
  notes: string;
}

interface Summary {
  monthLabel: string;
  total: number;
  count: number;
  perPerson: Record<string, number>;
  perCategory: Record<string, number>;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const PERSON_KEY = "mt.person";

/** Downscale a photo client-side so uploads stay small and fast. */
async function downscaleImage(file: File): Promise<Blob> {
  const MAX_DIM = 1600;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    return blob ?? file;
  } catch {
    return file; // e.g. HEIC on some browsers — send as-is, Gemini handles it
  }
}

export default function ExpenseTracker({ people }: { people: string[] }) {
  const [authed, setAuthed] = useState<"checking" | "no" | "yes">("checking");
  const [pin, setPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  const [person, setPerson] = useState(people[0]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"idle" | "parsing" | "saving">("idle");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryError("");
    try {
      const res = await fetch("/api/summary");
      if (res.status === 401) {
        setAuthed("no");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load summary");
      setSummary(data);
    } catch (err) {
      setSummaryError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(PERSON_KEY);
    if (saved && people.includes(saved)) setPerson(saved);
    fetch("/api/auth").then((res) => setAuthed(res.ok ? "yes" : "no"));
  }, [people]);

  useEffect(() => {
    if (authed === "yes") loadSummary();
  }, [authed, loadSummary]);

  const choosePerson = (name: string) => {
    setPerson(name);
    localStorage.setItem(PERSON_KEY, name);
  };

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pinBusy) return;
    setPinBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        setAuthed("yes");
        setPin("");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Wrong PIN");
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setPinBusy(false);
    }
  };

  const applyParsed = (expense: ParsedExpense) => {
    setDraft({
      date: expense.date,
      person: people.includes(expense.person) ? expense.person : person,
      amount: expense.amount ? String(expense.amount) : "",
      merchant: expense.merchant,
      category: expense.category,
      notes: expense.notes,
    });
  };

  const handleParseResponse = async (res: Response) => {
    if (res.status === 401) {
      setAuthed("no");
      return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Something went wrong");
    applyParsed(data.expense);
  };

  const parseText = async () => {
    if (!text.trim() || busy !== "idle") return;
    setBusy("parsing");
    setError("");
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, person }),
      });
      await handleParseResponse(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("idle");
    }
  };

  const parsePhoto = async (file: File) => {
    if (busy !== "idle") return;
    setBusy("parsing");
    setError("");
    try {
      const blob = await downscaleImage(file);
      const form = new FormData();
      form.append("image", blob, "receipt.jpg");
      form.append("person", person);
      const res = await fetch("/api/parse", { method: "POST", body: form });
      await handleParseResponse(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("idle");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveDraft = async () => {
    if (!draft || busy !== "idle") return;
    const amount = parseFloat(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount before saving.");
      return;
    }
    setBusy("saving");
    setError("");
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, amount }),
      });
      if (res.status === 401) {
        setAuthed("no");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      showToast(
        `Logged ${usd.format(amount)}${draft.merchant ? ` at ${draft.merchant}` : ""} ✓`
      );
      setDraft(null);
      setText("");
      loadSummary();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("idle");
    }
  };

  const setDraftField = (field: keyof Draft, value: string) =>
    setDraft((d) => (d ? { ...d, [field]: value } : d));

  /* ── PIN gate ─────────────────────────────────── */
  if (authed === "checking") {
    return (
      <div className="pin-screen">
        <span className="muted">Loading…</span>
      </div>
    );
  }

  if (authed === "no") {
    return (
      <div className="pin-screen">
        <form className="card pin-card" onSubmit={submitPin}>
          <h1>💸 Money Tracker</h1>
          <p>Enter the shared PIN</p>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus
          />
          {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={pinBusy || !pin}>
            {pinBusy ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    );
  }

  /* ── Main app ─────────────────────────────────── */
  const maxCategory = summary
    ? Math.max(...Object.values(summary.perCategory), 1)
    : 1;

  return (
    <div className="container">
      <header className="header">
        <h1>💸 Money Tracker</h1>
        <div className="person-toggle" role="group" aria-label="Who is logging">
          {people.map((name) => (
            <button
              key={name}
              type="button"
              className={person === name ? "active" : ""}
              onClick={() => choosePerson(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {!draft && (
        <section className="card">
          <h2>Log an expense</h2>
          <textarea
            placeholder={'"$43 Costco groceries" or "spent 12 bucks on coffee yesterday"'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                parseText();
              }
            }}
            disabled={busy !== "idle"}
          />
          <div className="btn-row">
            <button
              className="btn"
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy !== "idle"}
            >
              📷 Receipt
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={parseText}
              disabled={busy !== "idle" || !text.trim()}
            >
              {busy === "parsing" ? (
                <>
                  <span className="spin">◐</span> Parsing…
                </>
              ) : (
                "Log expense"
              )}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) parsePhoto(f);
            }}
          />
        </section>
      )}

      {draft && (
        <section className="card">
          <h2>Confirm expense</h2>
          <div className="field-row">
            <div className="field">
              <label htmlFor="d-amount">Amount</label>
              <input
                id="d-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={draft.amount}
                onChange={(e) => setDraftField("amount", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="d-date">Date</label>
              <input
                id="d-date"
                type="date"
                value={draft.date}
                onChange={(e) => setDraftField("date", e.target.value)}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="d-person">Person</label>
              <select
                id="d-person"
                value={draft.person}
                onChange={(e) => setDraftField("person", e.target.value)}
              >
                {people.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="d-category">Category</label>
              <select
                id="d-category"
                value={draft.category}
                onChange={(e) => setDraftField("category", e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="d-merchant">Merchant</label>
            <input
              id="d-merchant"
              type="text"
              value={draft.merchant}
              onChange={(e) => setDraftField("merchant", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="d-notes">Notes</label>
            <input
              id="d-notes"
              type="text"
              value={draft.notes}
              onChange={(e) => setDraftField("notes", e.target.value)}
            />
          </div>
          <div className="btn-row">
            <button
              className="btn"
              type="button"
              onClick={() => setDraft(null)}
              disabled={busy === "saving"}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={saveDraft}
              disabled={busy === "saving"}
            >
              {busy === "saving" ? "Saving…" : "Save"}
            </button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>This Month{summary ? ` — ${summary.monthLabel}` : ""}</h2>
        {summaryError && <div className="error-banner">{summaryError}</div>}
        {!summary && !summaryError && <span className="muted">Loading…</span>}
        {summary && (
          <>
            <div className="summary-total">{usd.format(summary.total)}</div>
            <div className="summary-sub">
              {summary.count} expense{summary.count === 1 ? "" : "s"} logged
            </div>

            <div className="summary-section">
              <h3>By person</h3>
              {Object.entries(summary.perPerson).map(([name, amt]) => (
                <div className="summary-row" key={name}>
                  <span className="name">{name}</span>
                  <span>{usd.format(amt)}</span>
                </div>
              ))}
            </div>

            <div className="summary-section">
              <h3>By category</h3>
              {Object.entries(summary.perCategory).length === 0 && (
                <span className="muted">Nothing logged yet this month.</span>
              )}
              {Object.entries(summary.perCategory)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, amt]) => (
                  <div key={cat}>
                    <div className="summary-row">
                      <span className="name">{cat}</span>
                      <span>{usd.format(amt)}</span>
                    </div>
                    <div className="cat-bar-track">
                      <div
                        className="cat-bar-fill"
                        style={{ width: `${(amt / maxCategory) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
      </section>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
