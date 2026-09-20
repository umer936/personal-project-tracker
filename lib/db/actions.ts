"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import type {
  DatabaseFile,
  InboxOwner,
  OutreachItem,
  Task,
  TaskCadence,
  TaskStatus,
  TaskType,
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

export async function createOutreach(input: { name: string; topic: string; nextAction: string }) {
  const database = await readDatabase();
  const item: OutreachItem = {
    id: slugify(input.name),
    name: input.name.trim() || "New contact",
    topic: input.topic.trim() || "General follow-up",
    owner: "me",
    lastAction: todayString(),
    nextAction: input.nextAction.trim() || "Draft the first message.",
    done: false,
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

export async function updateOutreachOwner(itemId: string, owner: InboxOwner, lastAction: string) {
  const database = await readDatabase();
  database.outreachItems = database.outreachItems.map((item) =>
    item.id === itemId ? { ...item, owner, lastAction } : item,
  );
  await writeDatabase(database);
}

export async function toggleOutreachDone(itemId: string) {
  const database = await readDatabase();
  database.outreachItems = database.outreachItems.map((item) =>
    item.id === itemId ? { ...item, done: !item.done } : item,
  );
  await writeDatabase(database);
}
