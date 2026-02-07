"use client";

import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "err-day:entries:v1";
const ART_CELLS = 400;
const DAILY_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#ec4899",
];

type Entries = Record<string, string>;
type ArtCell = {
  id: string;
  isPainted: boolean;
};

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftDateKey(dateKey: string, byDays: number): string {
  const nextDate = parseDateKey(dateKey);
  nextDate.setDate(nextDate.getDate() + byDays);
  return formatDateKey(nextDate);
}

function formatDisplayDate(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parseDateKey(dateKey));
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function generateDailyArt(dateKey: string): {
  cells: ArtCell[];
  color: string;
} {
  const random = mulberry32(hashSeed(dateKey));
  const color = DAILY_COLORS[Math.floor(random() * DAILY_COLORS.length)];
  const cells = Array.from({ length: ART_CELLS }, (_, index) => ({
    id: `${dateKey}-${index}`,
    isPainted: random() > 0.62,
  }));
  return { cells, color };
}

function loadEntries(): Entries {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const nextEntries: Entries = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        nextEntries[key] = value;
      }
    }

    return nextEntries;
  } catch {
    return {};
  }
}

function getTodayDateKey(): string {
  return formatDateKey(new Date());
}

export default function Home() {
  const [todayDateKey, setTodayDateKey] = useState("");
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [entries, setEntries] = useState<Entries>({});
  const [draftEntry, setDraftEntry] = useState("");
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    const initialDate = getTodayDateKey();
    const loadedEntries = loadEntries();
    setTodayDateKey(initialDate);
    setSelectedDateKey(initialDate);
    setEntries(loadedEntries);
    setDraftEntry(loadedEntries[initialDate] ?? "");
  }, []);

  useEffect(() => {
    if (!todayDateKey) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries, todayDateKey]);

  useEffect(() => {
    if (!selectedDateKey) {
      return;
    }

    setDraftEntry(entries[selectedDateKey] ?? "");
  }, [entries, selectedDateKey]);

  useEffect(() => {
    if (!selectedDateKey) {
      return;
    }

    setShowSaved(false);
  }, [selectedDateKey]);

  useEffect(() => {
    if (!showSaved) {
      return;
    }

    const timeout = window.setTimeout(() => setShowSaved(false), 3200);
    return () => window.clearTimeout(timeout);
  }, [showSaved]);

  const isReady = todayDateKey.length > 0;
  const isTodaySelected = isReady && selectedDateKey === todayDateKey;
  const hasSubmittedForSelectedDay = selectedDateKey
    ? Object.hasOwn(entries, selectedDateKey)
    : false;
  const isEditable = isTodaySelected && !hasSubmittedForSelectedDay;
  const savedEntry = selectedDateKey ? (entries[selectedDateKey] ?? "") : "";
  const hasUnsavedChanges = draftEntry !== savedEntry;

  function handleThoughtSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isEditable) {
      return;
    }

    setEntries((previous) => ({
      ...previous,
      [selectedDateKey]: draftEntry,
    }));
    setShowSaved(true);
  }

  const art = useMemo(
    () =>
      selectedDateKey
        ? generateDailyArt(selectedDateKey)
        : { cells: [], color: DAILY_COLORS[0] },
    [selectedDateKey],
  );

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-8">
        <header className="border border-neutral-300 bg-white p-4">
          <h1 className="text-3xl font-semibold tracking-tight">Err Day</h1>
          <p className="mt-2 text-sm text-neutral-600">
            One daily thought, one daily generated piece.
          </p>
        </header>

        {!isReady ? (
          <section className="border border-neutral-300 bg-white p-4 text-sm text-neutral-600">
            Loading today&apos;s entry...
          </section>
        ) : (
          <>
            <section className="border border-neutral-300 bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                  onClick={() =>
                    setSelectedDateKey((previous) => shiftDateKey(previous, -1))
                  }
                  type="button"
                >
                  Previous day
                </button>
                <button
                  className="border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                  onClick={() => setSelectedDateKey(todayDateKey)}
                  type="button"
                >
                  Today
                </button>
                <button
                  className="border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100"
                  onClick={() =>
                    setSelectedDateKey((previous) => shiftDateKey(previous, 1))
                  }
                  type="button"
                >
                  Next day
                </button>
                <strong className="text-sm">
                  {formatDisplayDate(selectedDateKey)}
                </strong>
                <span className="text-xs uppercase tracking-wide text-neutral-500">
                  {isEditable
                    ? "Editable"
                    : hasSubmittedForSelectedDay
                      ? "Submitted"
                      : "Read only"}
                </span>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <section className="border border-neutral-300 bg-white p-4">
                <h2 className="text-lg font-semibold">Thought for the day</h2>
                <p className="mt-2 text-sm text-neutral-600">
                  Write feelings, goals, or what happened today.
                </p>
                <form className="mt-4" onSubmit={handleThoughtSubmit}>
                  <textarea
                    className="min-h-72 w-full border border-neutral-300 p-3 text-sm outline-none focus:border-neutral-500 disabled:bg-neutral-100 disabled:text-neutral-500"
                    disabled={!isEditable}
                    onChange={(event) => {
                      setDraftEntry(event.target.value);
                      setShowSaved(false);
                    }}
                    placeholder={
                      isEditable
                        ? "Today is editable. Write your thought."
                        : hasSubmittedForSelectedDay
                          ? "This thought was already submitted and is now locked."
                          : "This day is locked. You can only edit today."
                    }
                    value={draftEntry}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      className="border border-neutral-300 bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-300"
                      disabled={!isEditable || !hasUnsavedChanges}
                      type="submit"
                    >
                      Capture this thought
                    </button>
                    <AnimatePresence mode="wait">
                      {showSaved ? (
                        <motion.p
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs font-medium text-emerald-700"
                          exit={{ opacity: 0, y: -8 }}
                          initial={{ opacity: 0, y: 8 }}
                          key={`${selectedDateKey}-${savedEntry.length}`}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                        >
                          Thought saved for today.
                        </motion.p>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </form>
                <p className="mt-2 text-xs text-neutral-500">
                  {isEditable
                    ? "You can edit until you submit this thought."
                    : hasSubmittedForSelectedDay
                      ? "Today is already submitted and cannot be edited again."
                      : "Navigate to today to edit your entry."}
                </p>
              </section>

              <section className="border border-neutral-300 bg-white p-4">
                <h2 className="text-lg font-semibold">Daily art</h2>
                <p className="mt-2 text-sm text-neutral-600">
                  20x20 generated pattern with one color tied to this date.
                </p>
                <div className="mt-4 grid aspect-square w-full max-w-80 grid-cols-20 border border-neutral-300 bg-neutral-50">
                  {art.cells.map((cell) => (
                    <div
                      className="border border-neutral-200"
                      key={cell.id}
                      style={{
                        backgroundColor: cell.isPainted
                          ? art.color
                          : "transparent",
                      }}
                    />
                  ))}
                </div>
                <p className="mt-3 text-xs text-neutral-500">
                  Daily color: <span className="font-mono">{art.color}</span>
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Pattern is deterministic and changes by day.
                </p>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
