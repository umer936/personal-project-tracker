// Domain model for the Rhythm planner.
// Data is persisted in data/database.json via the server actions in ./actions.ts.

// ---------- Goals (life-improvement tracker) ----------

export type GoalCategory = "prayer" | "exercise" | "stretch" | "reading" | "video" | "other";

// How a goal is measured:
// - "daily":   do it N times per day, every day of the month (prayers: 5/day)
// - "count":   do it N times per month (exercise 3x, stretch 3x, reading 1 book)
// - "project": a monthly deliverable with steps; paced against the calendar (YouTube video)
export type GoalType = "daily" | "count" | "project";

export type GoalStep = {
  id: string;
  title: string;
  completed: boolean;
};

// Per-month state for count/project goals.
export type MonthState = {
  count?: number; // "count" goals: completions logged this month
  steps?: GoalStep[]; // "project" goals: pipeline steps for this month
};

export type Goal = {
  id: string;
  title: string;
  category: GoalCategory;
  type: GoalType;

  // "daily"
  perDay?: number; // e.g. 5 prayers

  // "count"
  monthlyTarget?: number; // e.g. 3 sessions, 1 book
  unit?: string; // "sessions" | "books" | ...

  // "project"
  stepTemplate?: string[]; // default steps applied to each month

  // Progress storage
  dailyLog: Record<string, number>; // "YYYY-MM-DD" -> completions that day (daily goals)
  months: Record<string, MonthState>; // "YYYY-MM" -> per-month state (count/project goals)

  notes: string;
};

// ---------- Outreach (contact / follow-up pipeline) ----------

export type OutreachChannel = "email" | "text" | "call" | "dm" | "meet";

export type OutreachStage = "todo" | "waiting" | "done";

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
  goals: Goal[];
  outreachItems: OutreachItem[];
};
