// Domain model for the Task Rhythm Planner.
// Data is persisted in data/database.json via the server actions in ./actions.ts.

export type TaskType = "video" | "prayer" | "exercise" | "outreach" | "admin";

export type TaskStatus = "planned" | "in-progress" | "waiting" | "done" | "postponed";

export type TaskCadence = "one-off" | "daily" | "weekly" | "monthly";

export type TaskSubtask = {
  id: string;
  title: string;
  note: string;
  completed: boolean;
};

export type MonthlyProgress = {
  target: number;
  completed: number;
};

export type Task = {
  id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  tags: string[];
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  cadence: TaskCadence;
  targetPerMonth: number;
  monthlyProgress: Record<string, MonthlyProgress>;
  notes: string;
  subtasks: TaskSubtask[];
};

export type InboxOwner = "me" | "them";

export type OutreachItem = {
  id: string;
  name: string;
  topic: string;
  owner: InboxOwner;
  lastAction: string; // YYYY-MM-DD
  nextAction: string;
  done: boolean;
};

export type DatabaseFile = {
  version: number;
  tasks: Task[];
  outreachItems: OutreachItem[];
};
