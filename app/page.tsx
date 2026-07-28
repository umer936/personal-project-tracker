"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Task, OutreachItem, TaskType, TaskStatus, InboxOwner } from "@/lib/db/schema";
import {
  getTasks,
  getOutreachItems,
  updateTaskStatus,
  updateTaskNotes,
  updateSubtask,
  updateOutreachOwner,
  toggleOutreachDone,
} from "@/lib/db/actions";

type TaskTypeMeta = {
  label: string;
  gradient: string;
  glow: string;
  description: string;
};

const TASK_TYPE_META: Record<TaskType, TaskTypeMeta> = {
  video: {
    label: "YouTube",
    gradient: "from-amber-500 via-orange-500 to-rose-500",
    glow: "shadow-amber-500/50",
    description: "Idea → script → record → edit → publish",
  },
  prayer: {
    label: "Prayer",
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    glow: "shadow-emerald-500/50",
    description: "Daily rhythm and recovery",
  },
  exercise: {
    label: "Exercise",
    gradient: "from-sky-500 via-blue-500 to-indigo-500",
    glow: "shadow-sky-500/50",
    description: "Monthly target and streak",
  },
  outreach: {
    label: "Outreach",
    gradient: "from-fuchsia-500 via-pink-500 to-rose-500",
    glow: "shadow-fuchsia-500/50",
    description: "Inbox pipeline and follow-up",
  },
  admin: {
    label: "Admin",
    gradient: "from-violet-500 via-purple-500 to-indigo-500",
    glow: "shadow-violet-500/50",
    description: "Docs, notes, and cleanup",
  },
};

const CELL_WIDTH = 20;
const TASK_COLUMN_WIDTH = 240;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function buildTimeline(tasks: Task[]) {
  const taskDates = tasks.flatMap((task) => [parseDate(task.start), parseDate(task.end)]);
  const today = startOfDay(new Date());
  const earliest = new Date(Math.min(...taskDates.map((date) => date.getTime()), today.getTime()));
  const latest = new Date(Math.max(...taskDates.map((date) => date.getTime()), today.getTime()));
  const start = addDays(startOfDay(earliest), -7);
  const end = addDays(startOfDay(latest), 7);

  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const dayIndexByKey = new Map(days.map((day, index) => [monthKey(day) + `-${pad(day.getDate())}`, index]));

  const months: Array<{ key: string; label: string; startIndex: number; length: number }> = [];
  let index = 0;
  while (index < days.length) {
    const currentKey = monthKey(days[index]);
    const startIndex = index;
    while (index < days.length && monthKey(days[index]) === currentKey) {
      index += 1;
    }
    months.push({
      key: currentKey,
      label: formatMonth(days[startIndex]),
      startIndex,
      length: index - startIndex,
    });
  }

  return { days, months, dayIndexByKey };
}

function daysSince(dateString: string) {
  const target = parseDate(dateString);
  const today = startOfDay(new Date());
  const diff = today.getTime() - startOfDay(target).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function Home() {
  const ganttScrollRef = useRef<HTMLDivElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [outreachItems, setOutreachItems] = useState<OutreachItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<TaskType[]>(["video", "prayer", "exercise", "outreach", "admin"]);
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    startTransition(async () => {
      const [fetchedTasks, fetchedOutreach] = await Promise.all([getTasks(), getOutreachItems()]);
      setTasks(fetchedTasks);
      setOutreachItems(fetchedOutreach);
      if (fetchedTasks.length > 0 && !selectedTaskId) {
        setSelectedTaskId(fetchedTasks[0].id);
      }
      setLocalNotes(Object.fromEntries(fetchedTasks.map((task) => [task.id, task.notes])));
    });
  }, [selectedTaskId]);

  const timeline = useMemo(() => (tasks.length > 0 ? buildTimeline(tasks) : { days: [], months: [], dayIndexByKey: new Map() }), [tasks]);

  const allTags = useMemo(() => Array.from(new Set(tasks.flatMap((task) => task.tags))).sort((a, b) => a.localeCompare(b)), [tasks]);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);

  const visibleTasks = tasks.filter((task) => {
    const typeAllowed = selectedTypes.includes(task.type);
    const tagAllowed = selectedTag === "all" || task.tags.includes(selectedTag);
    return typeAllowed && tagAllowed;
  });

  const openOutreachItems = outreachItems.filter((item) => !item.done);
  const waitingOnMe = openOutreachItems.filter((item) => item.owner === "me");
  const waitingOnThem = openOutreachItems.filter((item) => item.owner === "them");
  const staleInMyCourt = waitingOnMe.filter((item) => daysSince(item.lastAction) > 3).length;

  const todayIndex =
    timeline.dayIndexByKey.get(monthKey(startOfDay(new Date())) + `-${pad(new Date().getDate())}`) ?? -1;

  const scrollToToday = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const container = ganttScrollRef.current;
      if (!container || todayIndex < 0) {
        return;
      }

      const timelineOffset = TASK_COLUMN_WIDTH + todayIndex * CELL_WIDTH;
      const targetLeft = Math.max(0, timelineOffset - container.clientWidth * 0.45);
      container.scrollTo({ left: targetLeft, behavior });
    },
    [todayIndex],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      scrollToToday("auto");
    }, 80);

    return () => window.clearTimeout(timer);
  }, [scrollToToday]);

  const toggleType = (type: TaskType) => {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type],
    );
  };

  const handleSubtaskToggle = (taskId: string, subtaskId: string, currentlyDone: boolean) => {
    startTransition(async () => {
      await updateSubtask(taskId, subtaskId, !currentlyDone);
      const refreshed = await getTasks();
      setTasks(refreshed);
    });
  };

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    startTransition(async () => {
      await updateTaskStatus(taskId, status);
      const refreshed = await getTasks();
      setTasks(refreshed);
    });
  };

  const handleNotesBlur = (taskId: string, notes: string) => {
    startTransition(async () => {
      await updateTaskNotes(taskId, notes);
    });
  };

  const handleOutreachOwnerChange = (itemId: string, owner: InboxOwner) => {
    startTransition(async () => {
      const today = startOfDay(new Date());
      const dateString = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
      await updateOutreachOwner(itemId, owner, dateString);
      const refreshed = await getOutreachItems();
      setOutreachItems(refreshed);
    });
  };

  const handleOutreachToggleDone = (itemId: string) => {
    startTransition(async () => {
      await toggleOutreachDone(itemId);
      const refreshed = await getOutreachItems();
      setOutreachItems(refreshed);
    });
  };

  const selectedSubtasks = selectedTask?.subtasks ?? [];
  const currentStepIndex = selectedSubtasks.findIndex((s) => !s.completed);
  const activeStepIndex = currentStepIndex === -1 ? Math.max(selectedSubtasks.length - 1, 0) : currentStepIndex;
  const doneCount = selectedSubtasks.filter((s) => s.completed).length;
  const completionPercent = selectedSubtasks.length === 0 ? 0 : Math.round((doneCount / selectedSubtasks.length) * 100);

  const selectedTypeMeta = selectedTask ? TASK_TYPE_META[selectedTask.type] : TASK_TYPE_META.video;

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      {/* Animated background gradient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 animate-pulse rounded-full bg-gradient-to-br from-cyan-500/20 to-transparent blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 animate-pulse rounded-full bg-gradient-to-bl from-fuchsia-500/20 to-transparent blur-3xl" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-20 left-1/3 h-96 w-96 animate-pulse rounded-full bg-gradient-to-t from-amber-500/20 to-transparent blur-3xl" style={{ animationDelay: "2s" }} />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Header with diagonal accent */}
        <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/80 to-slate-900/90 p-8 backdrop-blur-xl">
          <div className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 blur-3xl" />
          <div className="relative">
            <div className="mb-2 inline-block rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-1 text-xs font-medium uppercase tracking-widest text-cyan-300">
              Personal Planner
            </div>
            <h1 className="mb-3 max-w-3xl bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
              Task rhythm dashboard
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-slate-300">
              Gantt-style timeline • outreach pipeline • recurring goal tracking
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-widest text-slate-400">Today</p>
              <p className="mt-1 text-xl font-semibold text-white">{formatDate(startOfDay(new Date()))}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-widest text-slate-400">Visible tasks</p>
              <p className="mt-1 text-xl font-semibold text-white">{visibleTasks.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-widest text-slate-400">Progress</p>
              <p className="mt-1 text-xl font-semibold text-white">{completionPercent}%</p>
            </div>
          </div>
        </header>

        {/* Filters with asymmetric layout */}
        <section className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Filters</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedTypes(["video", "prayer", "exercise", "outreach", "admin"]);
                  setSelectedTag("all");
                }}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => scrollToToday()}
                className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-100 transition hover:bg-cyan-500/20"
              >
                Jump to today
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(Object.entries(TASK_TYPE_META) as Array<[TaskType, TaskTypeMeta]>).map(([type, meta]) => {
                const active = selectedTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className={cn(
                      "group relative overflow-hidden rounded-xl border px-4 py-2 text-sm font-medium transition-all",
                      active
                        ? `border-white/20 bg-gradient-to-r ${meta.gradient} shadow-lg ${meta.glow}`
                        : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20",
                    )}
                  >
                    <span className={active ? "text-white" : ""}>{meta.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedTag("all")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition",
                  selectedTag === "all"
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20",
                )}
              >
                All tags
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(tag)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition",
                    selectedTag === tag
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20",
                  )}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Gantt chart with creative design */}
        <section className="rounded-3xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl">
          <h2 className="mb-4 text-lg font-semibold text-white">Timeline</h2>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80">
            <div ref={ganttScrollRef} className="overflow-x-auto">
              <div style={{ minWidth: `${TASK_COLUMN_WIDTH + timeline.days.length * CELL_WIDTH}px` }}>
                {/* Month headers */}
                <div
                  className="grid border-b border-white/10 bg-slate-900/90 text-xs font-medium uppercase tracking-wider text-slate-400"
                  style={{ gridTemplateColumns: `${TASK_COLUMN_WIDTH}px minmax(0, 1fr)` }}
                >
                  <div className="sticky left-0 z-20 border-r border-white/10 bg-slate-900/95 px-4 py-3">Tasks</div>
                  <div className="flex">
                    {timeline.months.map((month) => (
                      <div
                        key={month.key}
                        className="border-l border-white/5 px-3 py-3"
                        style={{ width: month.length * CELL_WIDTH }}
                      >
                        {month.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Day headers */}
                <div
                  className="grid border-b border-white/10 bg-slate-900/80"
                  style={{ gridTemplateColumns: `${TASK_COLUMN_WIDTH}px minmax(0, 1fr)` }}
                >
                  <div className="sticky left-0 z-20 border-r border-white/10 bg-slate-900/90 px-4 py-2 text-[10px] uppercase tracking-wider text-slate-500">
                    Status
                  </div>
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${timeline.days.length}, ${CELL_WIDTH}px)` }}>
                    {timeline.days.map((day) => (
                      <div
                        key={`day-${day.toISOString()}`}
                        className={cn(
                          "flex h-8 items-center justify-center border-l border-white/5 text-[9px] text-slate-500",
                          day.getDate() === 1 && "bg-white/5 text-cyan-300",
                        )}
                      >
                        {day.getDate()}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Task rows */}
                {visibleTasks.map((task) => {
                  const startIndex =
                    timeline.dayIndexByKey.get(
                      `${monthKey(parseDate(task.start))}-${pad(parseDate(task.start).getDate())}`,
                    ) ?? 0;
                  const endIndex =
                    timeline.dayIndexByKey.get(
                      `${monthKey(parseDate(task.end))}-${pad(parseDate(task.end).getDate())}`,
                    ) ?? timeline.days.length - 1;
                  const meta = TASK_TYPE_META[task.type];
                  const selected = selectedTaskId === task.id;
                  const taskDoneCount = task.subtasks.filter((s) => s.completed).length;
                  const taskPercent =
                    task.subtasks.length === 0 ? 0 : Math.round((taskDoneCount / task.subtasks.length) * 100);

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setSelectedTaskId(task.id)}
                      className={cn(
                        "grid w-full border-b border-white/10 text-left transition hover:bg-white/5",
                        selected && "bg-cyan-500/10",
                      )}
                      style={{ gridTemplateColumns: `${TASK_COLUMN_WIDTH}px minmax(0, 1fr)` }}
                    >
                      <div className="sticky left-0 z-10 border-r border-white/10 bg-slate-950/95 px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full bg-gradient-to-br", meta.gradient)} />
                          <span className="truncate text-sm font-medium text-white">{task.title}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                          <span className="capitalize">{task.cadence}</span>
                          <span>·</span>
                          <span>{taskPercent}%</span>
                        </div>
                      </div>

                      <div className="relative min-h-[60px] px-0 py-0">
                        <div
                          className="grid h-full"
                          style={{ gridTemplateColumns: `repeat(${timeline.days.length}, ${CELL_WIDTH}px)` }}
                        >
                          {timeline.days.map((day) => (
                            <div
                              key={`${task.id}-${day.toISOString()}`}
                              className={cn(
                                "border-l border-white/5",
                                (day.getDay() === 0 || day.getDay() === 6) && "bg-white/[0.015]",
                              )}
                            />
                          ))}
                        </div>

                        {/* Task bar */}
                        <div
                          className={cn(
                            "pointer-events-none absolute top-2 rounded-lg border shadow-lg",
                            task.status === "done"
                              ? "border-emerald-400/30 bg-gradient-to-r from-emerald-500/20 to-teal-500/20"
                              : task.status === "waiting"
                                ? "border-fuchsia-400/30 bg-gradient-to-r from-fuchsia-500/20 to-pink-500/20"
                                : `border-white/20 bg-gradient-to-r ${meta.gradient} opacity-80`,
                          )}
                          style={{
                            left: `${startIndex * CELL_WIDTH + 2}px`,
                            width: `${Math.max(1, endIndex - startIndex + 1) * CELL_WIDTH - 4}px`,
                            height: "calc(100% - 16px)",
                          }}
                        >
                          <div className="flex h-full flex-col justify-center px-2">
                            <p className="truncate text-[10px] font-semibold text-white">{task.title}</p>
                          </div>
                        </div>

                        {/* Today line */}
                        {todayIndex >= 0 && (
                          <div
                            className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.8)]"
                            style={{ left: `${todayIndex * CELL_WIDTH}px` }}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Split view: Task details + Outreach inbox */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Task details sidebar - redesigned as card */}
          {selectedTask && (
            <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/80 to-slate-900/90 p-6 backdrop-blur-xl">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className={cn("mb-2 inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider", `border-white/20 bg-gradient-to-r ${selectedTypeMeta.gradient} text-white`)}>
                    {selectedTask.type}
                  </div>
                  <h2 className="text-2xl font-bold text-white">{selectedTask.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">{selectedTypeMeta.description}</p>
                </div>
              </div>

              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Progress</span>
                  <span className="font-semibold">{completionPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn("h-full rounded-full bg-gradient-to-r", selectedTypeMeta.gradient)}
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleStatusChange(selectedTask.id, "done")}
                  className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-100 transition hover:bg-emerald-500/20"
                  disabled={isPending}
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(selectedTask.id, "waiting")}
                  className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/20"
                  disabled={isPending}
                >
                  Waiting
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange(selectedTask.id, "postponed")}
                  className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-500/20"
                  disabled={isPending}
                >
                  Postpone
                </button>
              </div>

              <div className="mb-4">
                <h3 className="mb-2 text-sm font-semibold text-white">Subtasks</h3>
                <div className="space-y-2">
                  {selectedSubtasks.map((subtask, index) => {
                    const current = index === activeStepIndex;
                    return (
                      <label
                        key={subtask.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition",
                          subtask.completed
                            ? "border-emerald-400/20 bg-emerald-500/10"
                            : current
                              ? "border-cyan-400/30 bg-cyan-500/10"
                              : "border-white/10 bg-white/5 hover:border-white/20",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={subtask.completed}
                          onChange={() => handleSubtaskToggle(selectedTask.id, subtask.id, subtask.completed)}
                          className="mt-0.5 h-4 w-4 rounded border-white/20"
                          disabled={isPending}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{subtask.title}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{subtask.note}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-white">Notes</h3>
                <textarea
                  value={localNotes[selectedTask.id] ?? ""}
                  onChange={(e) => setLocalNotes((prev) => ({ ...prev, [selectedTask.id]: e.target.value }))}
                  onBlur={(e) => handleNotesBlur(selectedTask.id, e.target.value)}
                  className="min-h-32 w-full rounded-xl border border-white/10 bg-slate-950/80 p-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50"
                  placeholder="Add notes..."
                  disabled={isPending}
                />
              </div>
            </section>
          )}

          {/* Outreach inbox - more creative layout */}
          <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-950/80 to-slate-900/90 p-6 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Outreach Inbox</h2>
              {staleInMyCourt > 0 && (
                <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
                  {staleInMyCourt} stale
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-cyan-100">Waiting on me</h3>
                  <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-xs text-cyan-100">
                    {waitingOnMe.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {waitingOnMe.length === 0 ? (
                    <p className="text-center text-sm text-slate-400">All clear!</p>
                  ) : (
                    waitingOnMe.map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="mb-2 flex items-start justify-between">
                          <div>
                            <p className="font-medium text-white">{item.name}</p>
                            <p className="text-xs text-cyan-200">{item.topic}</p>
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px]",
                              daysSince(item.lastAction) > 3
                                ? "bg-rose-500/20 text-rose-200"
                                : "bg-white/10 text-slate-300",
                            )}
                          >
                            {daysSince(item.lastAction)}d
                          </span>
                        </div>
                        <p className="mb-3 text-xs leading-relaxed text-slate-300">{item.nextAction}</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleOutreachOwnerChange(item.id, "them")}
                            className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-100 transition hover:bg-fuchsia-500/20"
                            disabled={isPending}
                          >
                            → Them
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOutreachToggleDone(item.id)}
                            className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100 transition hover:bg-emerald-500/20"
                            disabled={isPending}
                          >
                            ✓ Done
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-fuchsia-100">Waiting on them</h3>
                  <span className="rounded-full bg-fuchsia-400/20 px-2 py-0.5 text-xs text-fuchsia-100">
                    {waitingOnThem.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {waitingOnThem.length === 0 ? (
                    <p className="text-center text-sm text-slate-400">No pending replies</p>
                  ) : (
                    waitingOnThem.map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="mb-2 flex items-start justify-between">
                          <div>
                            <p className="font-medium text-white">{item.name}</p>
                            <p className="text-xs text-fuchsia-200">{item.topic}</p>
                          </div>
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">
                            {daysSince(item.lastAction)}d
                          </span>
                        </div>
                        <p className="mb-3 text-xs leading-relaxed text-slate-300">{item.nextAction}</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleOutreachOwnerChange(item.id, "me")}
                            className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/20"
                            disabled={isPending}
                          >
                            → Me
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOutreachToggleDone(item.id)}
                            className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100 transition hover:bg-emerald-500/20"
                            disabled={isPending}
                          >
                            ✓ Done
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
