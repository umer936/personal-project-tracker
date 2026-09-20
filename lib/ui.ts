import type { TaskStatus, TaskType } from "@/lib/db/schema";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function parseDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function toDateString(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function currentMonthKey() {
  return monthKey(new Date());
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

export function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(date);
}

export function daysSince(dateString: string) {
  const target = parseDate(dateString);
  const today = startOfDay(new Date());
  const diff = today.getTime() - startOfDay(target).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export type TypeMeta = {
  label: string;
  icon: string;
  accent: string; // solid text/border accent color
  gradient: string; // tailwind gradient stops
  soft: string; // soft background tint
  description: string;
};

export const TYPE_META: Record<TaskType, TypeMeta> = {
  video: {
    label: "YouTube",
    icon: "▶",
    accent: "text-amber-300",
    gradient: "from-amber-500 to-orange-500",
    soft: "bg-amber-500/10 border-amber-400/20 text-amber-200",
    description: "Idea → script → record → edit → publish",
  },
  prayer: {
    label: "Prayer",
    icon: "☾",
    accent: "text-emerald-300",
    gradient: "from-emerald-500 to-teal-500",
    soft: "bg-emerald-500/10 border-emerald-400/20 text-emerald-200",
    description: "Daily rhythm and recovery",
  },
  exercise: {
    label: "Exercise",
    icon: "⚡",
    accent: "text-sky-300",
    gradient: "from-sky-500 to-indigo-500",
    soft: "bg-sky-500/10 border-sky-400/20 text-sky-200",
    description: "Monthly target and streak",
  },
  outreach: {
    label: "Outreach",
    icon: "✉",
    accent: "text-fuchsia-300",
    gradient: "from-fuchsia-500 to-pink-500",
    soft: "bg-fuchsia-500/10 border-fuchsia-400/20 text-fuchsia-200",
    description: "Inbox pipeline and follow-up",
  },
  admin: {
    label: "Admin",
    icon: "◆",
    accent: "text-violet-300",
    gradient: "from-violet-500 to-purple-500",
    soft: "bg-violet-500/10 border-violet-400/20 text-violet-200",
    description: "Docs, notes, and cleanup",
  },
};

export type StatusMeta = { label: string; soft: string; dot: string };

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  planned: {
    label: "Planned",
    soft: "bg-slate-500/10 border-slate-400/20 text-slate-300",
    dot: "bg-slate-400",
  },
  "in-progress": {
    label: "In progress",
    soft: "bg-cyan-500/10 border-cyan-400/20 text-cyan-200",
    dot: "bg-cyan-400",
  },
  waiting: {
    label: "Waiting",
    soft: "bg-fuchsia-500/10 border-fuchsia-400/20 text-fuchsia-200",
    dot: "bg-fuchsia-400",
  },
  done: {
    label: "Done",
    soft: "bg-emerald-500/10 border-emerald-400/20 text-emerald-200",
    dot: "bg-emerald-400",
  },
  postponed: {
    label: "Postponed",
    soft: "bg-amber-500/10 border-amber-400/20 text-amber-200",
    dot: "bg-amber-400",
  },
};
