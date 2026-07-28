// Database schema types

export type TaskType = "video" | "prayer" | "exercise" | "outreach" | "admin";
export type TaskStatus = "in-progress" | "planned" | "waiting" | "postponed" | "missed" | "done";
export type InboxOwner = "me" | "them";

export type MonthlyProgress = {
  target: number;
  completed: number;
};

export type Subtask = {
  id: string;
  title: string;
  note: string;
  completed: boolean;
};

export type Task = {
  id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  tags: string[];
  start: string;
  end: string;
  cadence: string;
  targetPerMonth: number;
  monthlyProgress: Record<string, MonthlyProgress>;
  notes: string;
  subtasks: Subtask[];
};

export type OutreachItem = {
  id: string;
  name: string;
  topic: string;
  owner: InboxOwner;
  lastAction: string;
  nextAction: string;
  done: boolean;
};

export type Database = {
  tasks: Task[];
  outreachItems: OutreachItem[];
  version: number;
};
