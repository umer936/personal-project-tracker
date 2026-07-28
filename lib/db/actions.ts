"use server";

import { promises as fs } from "fs";
import path from "path";
import type { Database, Task, OutreachItem, TaskStatus, InboxOwner } from "./schema";
import { initialDatabase } from "./seed";

const DB_PATH = path.join(process.cwd(), "data", "database.json");

async function ensureDataDir() {
  const dataDir = path.join(process.cwd(), "data");
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

async function readDb(): Promise<Database> {
  try {
    await ensureDataDir();
    const content = await fs.readFile(DB_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    // If file doesn't exist, create it with seed data
    await writeDb(initialDatabase);
    return initialDatabase;
  }
}

async function writeDb(data: Database): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function getTasks(): Promise<Task[]> {
  const db = await readDb();
  return db.tasks;
}

export async function getOutreachItems(): Promise<OutreachItem[]> {
  const db = await readDb();
  return db.outreachItems;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  const db = await readDb();
  const task = db.tasks.find((t) => t.id === taskId);
  if (task) {
    task.status = status;
    await writeDb(db);
  }
}

export async function updateTaskNotes(taskId: string, notes: string): Promise<void> {
  const db = await readDb();
  const task = db.tasks.find((t) => t.id === taskId);
  if (task) {
    task.notes = notes;
    await writeDb(db);
  }
}

export async function updateSubtask(taskId: string, subtaskId: string, completed: boolean): Promise<void> {
  const db = await readDb();
  const task = db.tasks.find((t) => t.id === taskId);
  if (task) {
    const subtask = task.subtasks.find((s) => s.id === subtaskId);
    if (subtask) {
      subtask.completed = completed;
      await writeDb(db);
    }
  }
}

export async function updateOutreachOwner(itemId: string, owner: InboxOwner, lastAction: string): Promise<void> {
  const db = await readDb();
  const item = db.outreachItems.find((i) => i.id === itemId);
  if (item) {
    item.owner = owner;
    item.lastAction = lastAction;
    await writeDb(db);
  }
}

export async function toggleOutreachDone(itemId: string): Promise<void> {
  const db = await readDb();
  const item = db.outreachItems.find((i) => i.id === itemId);
  if (item) {
    item.done = !item.done;
    await writeDb(db);
  }
}
