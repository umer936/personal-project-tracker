import type { GoalCategory, OutreachChannel } from "@/lib/db/schema";

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

export function todayKey() {
  return toDateString(startOfDay(new Date()));
}

// ---------- Month helpers ----------

export function monthKeyOf(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function currentMonthKey() {
  return monthKeyOf(new Date());
}

// Shift a "YYYY-MM" key by N months.
export function addMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return monthKeyOf(date);
}

export function daysInMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

// "2026-09-04" style key for a given month + day-of-month.
export function dayKey(monthKey: string, day: number) {
  return `${monthKey}-${pad(day)}`;
}

export function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

export function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatShortDate(dateString: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(parseDate(dateString));
}

export function daysSince(dateString: string) {
  const target = parseDate(dateString);
  const today = startOfDay(new Date());
  const diff = today.getTime() - startOfDay(target).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

// Positive = days until the date; negative = days overdue.
export function daysUntil(dateString: string) {
  const target = startOfDay(parseDate(dateString));
  const today = startOfDay(new Date());
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------- Category metadata ----------

export type CategoryMeta = {
  label: string;
  icon: string;
  gradient: string; // tailwind gradient stops
  soft: string; // pill styling
};

export const CATEGORY_META: Record<GoalCategory, CategoryMeta> = {
  prayer: {
    label: "Prayer",
    icon: "☾",
    gradient: "from-emerald-500 to-teal-500",
    soft: "bg-emerald-500/10 border-emerald-400/20 text-emerald-200",
  },
  exercise: {
    label: "Exercise",
    icon: "⚡",
    gradient: "from-sky-500 to-indigo-500",
    soft: "bg-sky-500/10 border-sky-400/20 text-sky-200",
  },
  stretch: {
    label: "Stretch",
    icon: "🧘",
    gradient: "from-violet-500 to-purple-500",
    soft: "bg-violet-500/10 border-violet-400/20 text-violet-200",
  },
  reading: {
    label: "Reading",
    icon: "📖",
    gradient: "from-amber-500 to-orange-500",
    soft: "bg-amber-500/10 border-amber-400/20 text-amber-200",
  },
  video: {
    label: "YouTube",
    icon: "▶",
    gradient: "from-rose-500 to-pink-500",
    soft: "bg-rose-500/10 border-rose-400/20 text-rose-200",
  },
  blog: {
    label: "Blog",
    icon: "✍",
    gradient: "from-blue-500 to-cyan-500",
    soft: "bg-blue-500/10 border-blue-400/20 text-blue-200",
  },
  craft: {
    label: "Arts & Crafts",
    icon: "🎨",
    gradient: "from-pink-500 to-rose-500",
    soft: "bg-pink-500/10 border-pink-400/20 text-pink-200",
  },
  finance: {
    label: "Finance",
    icon: "💰",
    gradient: "from-green-500 to-emerald-500",
    soft: "bg-green-500/10 border-green-400/20 text-green-200",
  },
  rest: {
    label: "Rest Day",
    icon: "🌴",
    gradient: "from-teal-500 to-cyan-500",
    soft: "bg-teal-500/10 border-teal-400/20 text-teal-200",
  },
  soccer: {
    label: "Soccer",
    icon: "⚽",
    gradient: "from-lime-500 to-green-500",
    soft: "bg-lime-500/10 border-lime-400/20 text-lime-200",
  },
  other: {
    label: "Goal",
    icon: "◆",
    gradient: "from-slate-500 to-slate-400",
    soft: "bg-slate-500/10 border-slate-400/20 text-slate-300",
  },
};

// ---------- Outreach channel metadata ----------

export type ChannelMeta = { label: string; icon: string };

export const CHANNEL_META: Record<OutreachChannel, ChannelMeta> = {
  email: { label: "Email", icon: "✉" },
  text: { label: "Text", icon: "💬" },
  call: { label: "Call", icon: "☎" },
  dm: { label: "DM", icon: "@" },
  meet: { label: "Meet", icon: "🤝" },
};
