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

function seededCellNoise(
  seed: number,
  x: number,
  y: number,
  salt: number,
): number {
  let hash = seed;
  hash ^= Math.imul(x + 1, 374761393);
  hash ^= Math.imul(y + 1, 668265263);
  hash ^= Math.imul(salt + 1, 1597334677);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

function generateDailyArt(dateKey: string): {
  cells: ArtCell[];
  color: string;
} {
  const seed = hashSeed(dateKey);
  const random = mulberry32(seed);
  const gridSize = Math.floor(Math.sqrt(ART_CELLS));
  const color = DAILY_COLORS[Math.floor(random() * DAILY_COLORS.length)];
  const patternMode = Math.floor(random() * 5);
  const baseDensity = 0.16 + random() * 0.68;
  const clusterSize = 2 + Math.floor(random() * 5);
  const waveX = 0.8 + random() * 3.8;
  const waveY = 0.8 + random() * 3.8;
  const phaseX = random() * Math.PI * 2;
  const phaseY = random() * Math.PI * 2;
  const centerX = random();
  const centerY = random();
  const radius = 0.35 + random() * 0.45;

  const cells = Array.from({ length: ART_CELLS }, (_, index) => {
    const x = index % gridSize;
    const y = Math.floor(index / gridSize);
    const normalizedX = x / (gridSize - 1);
    const normalizedY = y / (gridSize - 1);

    const fineNoise = seededCellNoise(seed, x, y, 1);
    const clusterNoise = seededCellNoise(
      seed,
      Math.floor(x / clusterSize),
      Math.floor(y / clusterSize),
      2,
    );
    const wave =
      (Math.sin(normalizedX * waveX * Math.PI * 2 + phaseX) +
        Math.cos(normalizedY * waveY * Math.PI * 2 + phaseY) +
        2) /
      4;
    const radialDistance = Math.hypot(
      normalizedX - centerX,
      normalizedY - centerY,
    );
    const radial = 1 - Math.min(1, radialDistance / radius);
    const diagonal = 1 - Math.abs(normalizedX - normalizedY);

    let intensity = 0;
    if (patternMode === 0) {
      intensity = 0.52 * wave + 0.3 * clusterNoise + 0.18 * fineNoise;
    } else if (patternMode === 1) {
      intensity = 0.52 * radial + 0.28 * wave + 0.2 * fineNoise;
    } else if (patternMode === 2) {
      intensity = 0.5 * diagonal + 0.3 * clusterNoise + 0.2 * fineNoise;
    } else if (patternMode === 3) {
      intensity = 0.7 * clusterNoise + 0.3 * fineNoise;
    } else {
      intensity = 0.4 * wave + 0.35 * radial + 0.25 * clusterNoise;
    }

    const localThresholdJitter = 0.86 + seededCellNoise(seed, x, y, 3) * 0.28;
    return {
      id: `${dateKey}-${index}`,
      isPainted: intensity > baseDensity * localThresholdJitter,
    };
  });
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
  const [todayDateKey] = useState(() => getTodayDateKey());
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    getTodayDateKey(),
  );
  const [entries, setEntries] = useState<Entries>({});
  const [draftEntry, setDraftEntry] = useState("");
  const [hasLoadedEntries, setHasLoadedEntries] = useState(false);

  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    const loadedEntries = loadEntries();
    setEntries(loadedEntries);
    setHasLoadedEntries(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedEntries) {
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries, hasLoadedEntries]);

  useEffect(() => {
    if (!hasLoadedEntries) {
      return;
    }

    setDraftEntry(entries[selectedDateKey] ?? "");
  }, [entries, hasLoadedEntries, selectedDateKey]);

  const isTodaySelected = selectedDateKey === todayDateKey;
  const hasSubmittedForSelectedDay = selectedDateKey
    ? Object.hasOwn(entries, selectedDateKey)
    : false;
  const isEditable = isTodaySelected && !hasSubmittedForSelectedDay;
  const savedEntry = selectedDateKey ? (entries[selectedDateKey] ?? "") : "";
  const hasUnsavedChanges = draftEntry !== savedEntry;
  const overlayCopy = isEditable
    ? "TODAY IS EDITABLE. WRITE YOUR THOUGHTS."
    : hasSubmittedForSelectedDay
      ? "THIS DAY IS LOCKED."
      : "ONLY TODAY IS EDITABLE.";

  useEffect(() => {
    if (!showSaved) {
      return;
    }

    const timeout = window.setTimeout(() => setShowSaved(false), 3200);
    return () => window.clearTimeout(timeout);
  }, [showSaved]);

  function handleThoughtSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isEditable || !hasUnsavedChanges) {
      return;
    }

    setEntries((previous) => ({
      ...previous,
      [selectedDateKey]: draftEntry,
    }));
    setShowSaved(true);
  }

  const currentArt = useMemo(
    () =>
      selectedDateKey
        ? generateDailyArt(selectedDateKey)
        : { cells: [], color: DAILY_COLORS[0] },
    [selectedDateKey],
  );

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="flex min-h-screen flex-col p-5">
        <section className="flex items-start justify-between gap-10 max-[1200px]:flex-col">
          <form
            className="w-full max-w-158 space-y-4"
            onSubmit={handleThoughtSubmit}
          >
            <div className="flex relative h-49 border-2 border-black">
              <textarea
                name="thought-description"
                className="h-full w-full resize-none bg-transparent p-5 text-base tracking-[0.08em] field-sizing-fixed outline-none disabled:cursor-default"
                disabled={!isEditable}
                onChange={(event) => {
                  setDraftEntry(event.target.value);
                  setShowSaved(false);
                }}
                value={draftEntry}
              />
              {draftEntry.length === 0 ? (
                <p className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center text-base tracking-[0.08em]">
                  {overlayCopy}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-4">
              <button
                className="h-8 w-full bg-black px-4 text-base text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isEditable || !hasUnsavedChanges}
                type="submit"
              >
                CAPTURE THIS THOUGHT
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

          <section
            aria-label="Current daily art"
            className="relative h-88 w-82 shrink-0"
          >
            <div className="absolute inset-3.5">
              <div className="grid h-full w-full grid-cols-20">
                {currentArt.cells.map((cell) => (
                  <div
                    key={cell.id}
                    style={{
                      backgroundColor: cell.isPainted
                        ? currentArt.color
                        : "transparent",
                    }}
                  />
                ))}
              </div>
            </div>
          </section>
        </section>

        <footer className="mt-auto grid grid-cols-1 items-end gap-6 pt-10 min-[1200px]:grid-cols-[1fr_auto_1fr]">
          <div className="space-y-2">
            <p>ERR DAY</p>
            <p>ONE DAILY THOUGHT, ONE DAILY GENERATED PIECE.</p>
          </div>

          <p className="justify-self-start text-base tracking-[0.08em] min-[1200px]:justify-self-center">
            {formatDisplayDate(selectedDateKey)}
          </p>

          <div className="flex flex-wrap justify-start gap-3 min-[1200px]:justify-self-end [&_button]:cursor-pointer [&_button]:hover:bg-neutral-100 [&_button]:transition-colors">
            <button
              className="h-8 border-2 border-black px-2.5 text-base"
              onClick={() => {
                setSelectedDateKey((previous) => shiftDateKey(previous, -1));
                setShowSaved(false);
              }}
              type="button"
            >
              PREVIOUS DAY
            </button>
            <button
              className="h-8 border-2 border-black px-2.5 text-base"
              onClick={() => {
                setSelectedDateKey(todayDateKey);
                setShowSaved(false);
              }}
              type="button"
            >
              TODAY
            </button>
            <button
              className="h-8 border-2 border-black px-2.5 text-base"
              onClick={() => {
                setSelectedDateKey((previous) => shiftDateKey(previous, 1));
                setShowSaved(false);
              }}
              type="button"
            >
              NEXT DAY
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
