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

export type OutreachChannel = "email" | "text" | "call" | "dm" | "meet";

// Pipeline stage for a contact/follow-up.
export type OutreachStage = "todo" | "waiting" | "done";

// A single logged interaction with a contact.
export type OutreachTouch = {
  date: string; // YYYY-MM-DD
  note: string;
};

export type OutreachItem = {
  id: string;
  name: string;
  topic: string;
  channel: OutreachChannel;
  stage: OutreachStage;
  lastAction: string; // YYYY-MM-DD — when you last touched this thread
  followUpOn: string | null; // YYYY-MM-DD — when to nudge next (null = no reminder)
  nextAction: string;
  history: OutreachTouch[];
};

export type DatabaseFile = {
  version: number;
  tasks: Task[];
  outreachItems: OutreachItem[];
};
