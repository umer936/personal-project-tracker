"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
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

const DATABASE_FILE_PATH = path.join(process.cwd(), "data", "database.json");

async function readDatabase(): Promise<DatabaseFile> {
  const raw = await fs.readFile(DATABASE_FILE_PATH, "utf8");
  return JSON.parse(raw) as DatabaseFile;
}

async function writeDatabase(database: DatabaseFile) {
  await fs.writeFile(DATABASE_FILE_PATH, JSON.stringify(database, null, 2), "utf8");
  revalidatePath("/");
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

// Deterministic id for a project step so the client and server always agree.
function stepIdFor(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------- Reads ----------

export async function getGoals() {
  const database = await readDatabase();
  return database.goals;
}

export async function getOutreachItems() {
  const database = await readDatabase();
  return database.outreachItems;
}

// ---------- Goal mutations ----------

function mapGoal(database: DatabaseFile, goalId: string, fn: (goal: Goal) => Goal) {
  database.goals = database.goals.map((g) => (g.id === goalId ? fn(g) : g));
}

// Set the completion count for a specific day (used by daily goals like prayer).
export async function setDailyCount(goalId: string, dateKey: string, count: number) {
  const database = await readDatabase();
  mapGoal(database, goalId, (goal) => {
    const max = goal.perDay ?? 1;
    const clamped = Math.max(0, Math.min(max, count));
    const dailyLog = { ...goal.dailyLog };
    if (clamped === 0) delete dailyLog[dateKey];
    else dailyLog[dateKey] = clamped;
    return { ...goal, dailyLog };
  });
  await writeDatabase(database);
}

// Adjust a count goal's monthly total (exercise/stretch/reading).
export async function adjustMonthCount(goalId: string, monthKey: string, delta: number) {
  const database = await readDatabase();
  mapGoal(database, goalId, (goal) => {
    const state = goal.months[monthKey] ?? {};
    const next = Math.max(0, (state.count ?? 0) + delta);
    return { ...goal, months: { ...goal.months, [monthKey]: { ...state, count: next } } };
  });
  await writeDatabase(database);
}

// Add a labeled entry to a count goal that records what you did (book read,
// craft made). The month count is derived from the number of entries.
export async function addMonthEntry(goalId: string, monthKey: string, label: string) {
  const trimmed = label.trim();
  if (!trimmed) return;
  const database = await readDatabase();
  mapGoal(database, goalId, (goal) => {
    const state = goal.months[monthKey] ?? {};
    const entries = [...(state.entries ?? []), trimmed];
    return {
      ...goal,
      months: { ...goal.months, [monthKey]: { ...state, entries, count: entries.length } },
    };
  });
  await writeDatabase(database);
}

// Remove one labeled entry by index.
export async function removeMonthEntry(goalId: string, monthKey: string, index: number) {
  const database = await readDatabase();
  mapGoal(database, goalId, (goal) => {
    const state = goal.months[monthKey] ?? {};
    const entries = (state.entries ?? []).filter((_, i) => i !== index);
    return {
      ...goal,
      months: { ...goal.months, [monthKey]: { ...state, entries, count: entries.length } },
    };
  });
  await writeDatabase(database);
}

// Toggle a project step for a given month (YouTube pipeline). Steps are
// initialised from the goal's template the first time a month is touched.
export async function toggleProjectStep(goalId: string, monthKey: string, stepId: string) {
  const database = await readDatabase();
  mapGoal(database, goalId, (goal) => {
    const template = goal.stepTemplate ?? [];
    const existing = goal.months[monthKey]?.steps;
    const steps: GoalStep[] =
      existing ??
      template.map((title) => ({ id: stepIdFor(title), title, completed: false }));
    const nextSteps = steps.map((s) => (s.id === stepId ? { ...s, completed: !s.completed } : s));
    return { ...goal, months: { ...goal.months, [monthKey]: { ...goal.months[monthKey], steps: nextSteps } } };
  });
  await writeDatabase(database);
}

export async function updateGoalNotes(goalId: string, notes: string) {
  const database = await readDatabase();
  mapGoal(database, goalId, (goal) => ({ ...goal, notes }));
  await writeDatabase(database);
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
  const database = await readDatabase();
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
      input.type === "project"
        ? input.stepTemplate ?? ["Idea", "Draft", "Finish"]
        : undefined,
    dailyLog: {},
    months: {},
    notes: "",
  };
  database.goals = [...database.goals, goal];
  await writeDatabase(database);
  return goal;
}

export async function deleteGoal(goalId: string) {
  const database = await readDatabase();
  // Core (locked) goals can't be deleted.
  database.goals = database.goals.filter((g) => g.id !== goalId || g.locked);
  await writeDatabase(database);
}

// ---------- Outreach mutations ----------

function addDaysString(base: string, days: number) {
  const [y, m, d] = base.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export async function createOutreach(input: {
  name: string;
  topic: string;
  nextAction: string;
  channel?: OutreachChannel;
  followUpInDays?: number | null;
}) {
  const database = await readDatabase();
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
  database.outreachItems = [item, ...database.outreachItems];
  await writeDatabase(database);
  return item;
}

export async function deleteOutreach(itemId: string) {
  const database = await readDatabase();
  database.outreachItems = database.outreachItems.filter((item) => item.id !== itemId);
  await writeDatabase(database);
}

export async function setOutreachStage(itemId: string, stage: OutreachStage) {
  const database = await readDatabase();
  database.outreachItems = database.outreachItems.map((item) =>
    item.id === itemId ? { ...item, stage } : item,
  );
  await writeDatabase(database);
}

// Log an interaction: records history, marks last-contacted today, moves the
// thread to "waiting", and schedules the next follow-up.
export async function logOutreachTouch(
  itemId: string,
  input: { note?: string; followUpInDays?: number } = {},
) {
  const database = await readDatabase();
  const today = todayString();
  const days = input.followUpInDays ?? 5;
  database.outreachItems = database.outreachItems.map((item) =>
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
  await writeDatabase(database);
}

// Push the follow-up reminder out by N days (keeps current stage).
export async function snoozeOutreach(itemId: string, days: number) {
  const database = await readDatabase();
  const today = todayString();
  database.outreachItems = database.outreachItems.map((item) =>
    item.id === itemId
      ? { ...item, followUpOn: addDaysString(item.followUpOn ?? today, days) }
      : item,
  );
  await writeDatabase(database);
}

export async function updateOutreachFields(
  itemId: string,
  patch: Partial<Pick<OutreachItem, "name" | "topic" | "channel" | "nextAction" | "followUpOn">>,
) {
  const database = await readDatabase();
  database.outreachItems = database.outreachItems.map((item) =>
    item.id === itemId ? { ...item, ...patch } : item,
  );
  await writeDatabase(database);
}
