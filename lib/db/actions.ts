"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import type {
  DatabaseFile,
  OutreachChannel,
  OutreachItem,
  OutreachStage,
  Task,
  TaskCadence,
  TaskStatus,
  TaskType,
} from "@/lib/db/schema";

const DATABASE_FILE_PATH = path.join(process.cwd(), "data", "database.json");

// Backfill any legacy outreach records (owner/done) into the new pipeline shape.
function normalizeOutreach(raw: Record<string, unknown>): OutreachItem {
  const legacyOwner = raw.owner as string | undefined;
  const legacyDone = raw.done as boolean | undefined;
  const stage: OutreachStage =
    (raw.stage as OutreachStage) ??
    (legacyDone ? "done" : legacyOwner === "them" ? "waiting" : "todo");
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "Untitled"),
    topic: String(raw.topic ?? ""),
    channel: (raw.channel as OutreachChannel) ?? "email",
    stage,
    lastAction: String(raw.lastAction ?? todayString()),
    followUpOn: (raw.followUpOn as string | null) ?? null,
    nextAction: String(raw.nextAction ?? ""),
    history: Array.isArray(raw.history) ? (raw.history as OutreachItem["history"]) : [],
  };
}

async function readDatabase(): Promise<DatabaseFile> {
  const raw = await fs.readFile(DATABASE_FILE_PATH, "utf8");
  const parsed = JSON.parse(raw) as DatabaseFile;
  parsed.outreachItems = (parsed.outreachItems ?? []).map((item) =>
    normalizeOutreach(item as unknown as Record<string, unknown>),
  );
  return parsed;
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

// ---------- Reads ----------

export async function getTasks() {
  const database = await readDatabase();
  return database.tasks;
}

export async function getOutreachItems() {
  const database = await readDatabase();
  return database.outreachItems;
}

// ---------- Task mutations ----------

export async function createTask(input: {
  title: string;
  type: TaskType;
  cadence: TaskCadence;
  tags?: string[];
  targetPerMonth?: number;
  start?: string;
  end?: string;
}) {
  const database = await readDatabase();
  const today = todayString();
  const monthKey = today.slice(0, 7);
  const target = input.targetPerMonth ?? 1;

  const task: Task = {
    id: slugify(input.title),
    title: input.title.trim() || "Untitled task",
    type: input.type,
    status: "planned",
    tags: input.tags?.filter(Boolean) ?? [],
    start: input.start ?? today,
    end: input.end ?? today,
    cadence: input.cadence,
    targetPerMonth: target,
    monthlyProgress: { [monthKey]: { target, completed: 0 } },
    notes: "",
    subtasks: [],
  };

  database.tasks = [task, ...database.tasks];
  await writeDatabase(database);
  return task;
}

export async function deleteTask(taskId: string) {
  const database = await readDatabase();
  database.tasks = database.tasks.filter((task) => task.id !== taskId);
  await writeDatabase(database);
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const database = await readDatabase();
  database.tasks = database.tasks.map((task) => (task.id === taskId ? { ...task, status } : task));
  await writeDatabase(database);
}

export async function updateTaskNotes(taskId: string, notes: string) {
  const database = await readDatabase();
  database.tasks = database.tasks.map((task) => (task.id === taskId ? { ...task, notes } : task));
  await writeDatabase(database);
}

export async function updateTaskTitle(taskId: string, title: string) {
  const database = await readDatabase();
  database.tasks = database.tasks.map((task) =>
    task.id === taskId ? { ...task, title: title.trim() || task.title } : task,
  );
  await writeDatabase(database);
}

export async function updateSubtask(taskId: string, subtaskId: string, completed: boolean) {
  const database = await readDatabase();
  database.tasks = database.tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          subtasks: task.subtasks.map((subtask) =>
            subtask.id === subtaskId ? { ...subtask, completed } : subtask,
          ),
        }
      : task,
  );
  await writeDatabase(database);
}

export async function addSubtask(taskId: string, title: string) {
  const database = await readDatabase();
  database.tasks = database.tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          subtasks: [
            ...task.subtasks,
            { id: slugify(title), title: title.trim() || "New step", note: "", completed: false },
          ],
        }
      : task,
  );
  await writeDatabase(database);
}

// Adjust this month's completed count for a task (used to log progress).
export async function adjustMonthlyProgress(taskId: string, delta: number) {
  const database = await readDatabase();
  const monthKey = todayString().slice(0, 7);
  database.tasks = database.tasks.map((task) => {
    if (task.id !== taskId) return task;
    const current = task.monthlyProgress[monthKey] ?? {
      target: task.targetPerMonth,
      completed: 0,
    };
    const completed = Math.max(0, Math.min(current.target, current.completed + delta));
    return {
      ...task,
      monthlyProgress: { ...task.monthlyProgress, [monthKey]: { ...current, completed } },
    };
  });
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
