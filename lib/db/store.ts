// Client-side data layer for the static export build.
//
// There is no server on a static host, so all reads/writes go to the browser's
// localStorage. The public API mirrors the old server actions in ./actions.ts,
// so the UI can call these the same way (all functions are async).
"use client";

import type {
  DatabaseFile,
  Goal,
  GoalCategory,
  GoalStep,
  GoalType,
  OutreachChannel,
  OutreachItem,
  OutreachStage,
} from "@/lib/db/schema";
import { DEFAULT_DATABASE, STORAGE_KEY } from "@/lib/db/seed";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// Read the database from localStorage, seeding it on first run. Any locked
// "core" goals in the seed that aren't present yet are merged in, so shipping a
// new default goal automatically shows up without wiping existing progress.
function read(): DatabaseFile {
  if (typeof window === "undefined") return clone(DEFAULT_DATABASE);

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = clone(DEFAULT_DATABASE);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  let db: DatabaseFile;
  try {
    db = JSON.parse(raw) as DatabaseFile;
  } catch {
    db = clone(DEFAULT_DATABASE);
  }

  db.goals = db.goals ?? [];
  db.outreachItems = db.outreachItems ?? [];

  // Merge in any new locked core goals from the seed.
  const existingIds = new Set(db.goals.map((g) => g.id));
  let changed = false;
  for (const seedGoal of DEFAULT_DATABASE.goals) {
    if (seedGoal.locked && !existingIds.has(seedGoal.id)) {
      db.goals.push(clone(seedGoal));
      changed = true;
    }
  }
  if (changed) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));

  return db;
}

function write(db: DatabaseFile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "item"}-${Math.random().toString(36).slice(2, 7)}`;
}

function todayString() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function addDaysString(base: string, days: number) {
  const [y, m, d] = base.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function stepIdFor(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function mapGoal(db: DatabaseFile, goalId: string, fn: (goal: Goal) => Goal) {
  db.goals = db.goals.map((g) => (g.id === goalId ? fn(g) : g));
}

// ---------- Reads ----------

export async function getGoals(): Promise<Goal[]> {
  return read().goals;
}

export async function getOutreachItems(): Promise<OutreachItem[]> {
  return read().outreachItems;
}

// ---------- Goal mutations ----------

export async function setDailyCount(goalId: string, dateKey: string, count: number) {
  const db = read();
  mapGoal(db, goalId, (goal) => {
    const max = goal.perDay ?? 1;
    const clamped = Math.max(0, Math.min(max, count));
    const dailyLog = { ...goal.dailyLog };
    if (clamped === 0) delete dailyLog[dateKey];
    else dailyLog[dateKey] = clamped;
    return { ...goal, dailyLog };
  });
  write(db);
}

export async function adjustMonthCount(goalId: string, monthKey: string, delta: number) {
  const db = read();
  mapGoal(db, goalId, (goal) => {
    const state = goal.months[monthKey] ?? {};
    const next = Math.max(0, (state.count ?? 0) + delta);
    return { ...goal, months: { ...goal.months, [monthKey]: { ...state, count: next } } };
  });
  write(db);
}

export async function addMonthEntry(goalId: string, monthKey: string, label: string) {
  const trimmed = label.trim();
  if (!trimmed) return;
  const db = read();
  mapGoal(db, goalId, (goal) => {
    const state = goal.months[monthKey] ?? {};
    const entries = [...(state.entries ?? []), trimmed];
    return {
      ...goal,
      months: { ...goal.months, [monthKey]: { ...state, entries, count: entries.length } },
    };
  });
  write(db);
}

export async function removeMonthEntry(goalId: string, monthKey: string, index: number) {
  const db = read();
  mapGoal(db, goalId, (goal) => {
    const state = goal.months[monthKey] ?? {};
    const entries = (state.entries ?? []).filter((_, i) => i !== index);
    return {
      ...goal,
      months: { ...goal.months, [monthKey]: { ...state, entries, count: entries.length } },
    };
  });
  write(db);
}

export async function toggleProjectStep(goalId: string, monthKey: string, stepId: string) {
  const db = read();
  mapGoal(db, goalId, (goal) => {
    const template = goal.stepTemplate ?? [];
    const existing = goal.months[monthKey]?.steps;
    const steps: GoalStep[] =
      existing ?? template.map((title) => ({ id: stepIdFor(title), title, completed: false }));
    const nextSteps = steps.map((s) => (s.id === stepId ? { ...s, completed: !s.completed } : s));
    return { ...goal, months: { ...goal.months, [monthKey]: { ...goal.months[monthKey], steps: nextSteps } } };
  });
  write(db);
}

export async function updateGoalNotes(goalId: string, notes: string) {
  const db = read();
  mapGoal(db, goalId, (goal) => ({ ...goal, notes }));
  write(db);
}

export async function createGoal(input: {
  title: string;
  category: GoalCategory;
  type: GoalType;
  perDay?: number;
  monthlyTarget?: number;
  unit?: string;
  logEntries?: boolean;
  stepTemplate?: string[];
}) {
  const db = read();
  const goal: Goal = {
    id: slugify(input.title),
    title: input.title.trim() || "New goal",
    category: input.category,
    type: input.type,
    locked: false,
    perDay: input.type === "daily" ? input.perDay ?? 1 : undefined,
    monthlyTarget: input.type === "count" ? input.monthlyTarget ?? 1 : undefined,
    unit: input.type === "count" ? input.unit ?? "times" : undefined,
    logEntries: input.type === "count" ? input.logEntries ?? false : undefined,
    stepTemplate:
      input.type === "project" ? input.stepTemplate ?? ["Idea", "Draft", "Finish"] : undefined,
    dailyLog: {},
    months: {},
    notes: "",
  };
  db.goals = [...db.goals, goal];
  write(db);
  return goal;
}

export async function deleteGoal(goalId: string) {
  const db = read();
  // Core (locked) goals can't be deleted.
  db.goals = db.goals.filter((g) => g.id !== goalId || g.locked);
  write(db);
}

// ---------- Outreach mutations ----------

export async function createOutreach(input: {
  name: string;
  topic: string;
  nextAction: string;
  channel?: OutreachChannel;
  followUpInDays?: number | null;
}) {
  const db = read();
  const today = todayString();
  const item: OutreachItem = {
    id: slugify(input.name),
    name: input.name.trim() || "New contact",
    topic: input.topic.trim() || "General follow-up",
    channel: input.channel ?? "email",
    stage: "todo",
    lastAction: today,
    followUpOn:
      input.followUpInDays && input.followUpInDays > 0
        ? addDaysString(today, input.followUpInDays)
        : null,
    nextAction: input.nextAction.trim() || "Draft the first message.",
    history: [],
  };
  db.outreachItems = [item, ...db.outreachItems];
  write(db);
  return item;
}

export async function deleteOutreach(itemId: string) {
  const db = read();
  db.outreachItems = db.outreachItems.filter((item) => item.id !== itemId);
  write(db);
}

export async function setOutreachStage(itemId: string, stage: OutreachStage) {
  const db = read();
  db.outreachItems = db.outreachItems.map((item) =>
    item.id === itemId ? { ...item, stage } : item,
  );
  write(db);
}

export async function logOutreachTouch(
  itemId: string,
  input: { note?: string; followUpInDays?: number } = {},
) {
  const db = read();
  const today = todayString();
  const days = input.followUpInDays ?? 5;
  db.outreachItems = db.outreachItems.map((item) =>
    item.id === itemId
      ? {
          ...item,
          stage: "waiting" as OutreachStage,
          lastAction: today,
          followUpOn: days > 0 ? addDaysString(today, days) : null,
          history: [{ date: today, note: input.note?.trim() || "Reached out" }, ...item.history],
        }
      : item,
  );
  write(db);
}

export async function snoozeOutreach(itemId: string, days: number) {
  const db = read();
  const today = todayString();
  db.outreachItems = db.outreachItems.map((item) =>
    item.id === itemId
      ? { ...item, followUpOn: addDaysString(item.followUpOn ?? today, days) }
      : item,
  );
  write(db);
}

export async function updateOutreachFields(
  itemId: string,
  patch: Partial<Pick<OutreachItem, "name" | "topic" | "channel" | "nextAction" | "followUpOn">>,
) {
  const db = read();
  db.outreachItems = db.outreachItems.map((item) =>
    item.id === itemId ? { ...item, ...patch } : item,
  );
  write(db);
}
