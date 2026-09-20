"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Task } from "@/lib/db/schema";
import {
  TYPE_META,
  addDays,
  cn,
  formatMonth,
  monthKey,
  pad,
  parseDate,
  startOfDay,
} from "@/lib/ui";

const CELL_WIDTH = 22;
const TASK_COLUMN_WIDTH = 220;

function buildTimeline(tasks: Task[]) {
  const taskDates = tasks.flatMap((task) => [parseDate(task.start), parseDate(task.end)]);
  const today = startOfDay(new Date());
  const times = [...taskDates.map((d) => d.getTime()), today.getTime()];
  const earliest = new Date(Math.min(...times));
  const latest = new Date(Math.max(...times));
  const start = addDays(startOfDay(earliest), -7);
  const end = addDays(startOfDay(latest), 7);

  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const dayIndexByKey = new Map(
    days.map((day, index) => [`${monthKey(day)}-${pad(day.getDate())}`, index]),
  );

  const months: Array<{ key: string; label: string; length: number }> = [];
  let index = 0;
  while (index < days.length) {
    const currentKey = monthKey(days[index]);
    const startIndex = index;
    while (index < days.length && monthKey(days[index]) === currentKey) index += 1;
    months.push({ key: currentKey, label: formatMonth(days[startIndex]), length: index - startIndex });
  }

  return { days, months, dayIndexByKey };
}

export function Timeline({
  tasks,
  selectedTaskId,
  onSelectAction,
}: {
  tasks: Task[];
  selectedTaskId: string;
  onSelectAction: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const timeline = useMemo(
    () =>
      tasks.length > 0
        ? buildTimeline(tasks)
        : { days: [] as Date[], months: [], dayIndexByKey: new Map<string, number>() },
    [tasks],
  );

  const todayIndex =
    timeline.dayIndexByKey.get(
      `${monthKey(startOfDay(new Date()))}-${pad(new Date().getDate())}`,
    ) ?? -1;

  const scrollToToday = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const container = scrollRef.current;
      if (!container || todayIndex < 0) return;
      const offset = TASK_COLUMN_WIDTH + todayIndex * CELL_WIDTH;
      container.scrollTo({ left: Math.max(0, offset - container.clientWidth * 0.45), behavior });
    },
    [todayIndex],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => scrollToToday("auto"), 80);
    return () => window.clearTimeout(timer);
  }, [scrollToToday]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-10 text-center text-sm text-slate-400">
        No tasks match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-sm font-medium text-slate-300">Timeline</p>
        <button
          type="button"
          onClick={() => scrollToToday()}
          className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/20"
        >
          Jump to today
        </button>
      </div>
      <div ref={scrollRef} className="overflow-x-auto">
        <div style={{ minWidth: `${TASK_COLUMN_WIDTH + timeline.days.length * CELL_WIDTH}px` }}>
          {/* Month headers */}
          <div
            className="grid border-b border-white/10 bg-slate-900/70 text-xs font-medium uppercase tracking-wider text-slate-400"
            style={{ gridTemplateColumns: `${TASK_COLUMN_WIDTH}px minmax(0, 1fr)` }}
          >
            <div className="sticky left-0 z-20 border-r border-white/10 bg-slate-900/90 px-4 py-3">
              Tasks
            </div>
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
            className="grid border-b border-white/10 bg-slate-900/60"
            style={{ gridTemplateColumns: `${TASK_COLUMN_WIDTH}px minmax(0, 1fr)` }}
          >
            <div className="sticky left-0 z-20 border-r border-white/10 bg-slate-900/80 px-4 py-2 text-[10px] uppercase tracking-wider text-slate-500">
              Day
            </div>
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${timeline.days.length}, ${CELL_WIDTH}px)` }}
            >
              {timeline.days.map((day) => (
                <div
                  key={`day-${day.toISOString()}`}
                  className={cn(
                    "flex h-8 items-center justify-center border-l border-white/5 text-[9px] text-slate-500",
                    day.getDate() === 1 && "bg-white/5 text-cyan-300",
                    todayIndex >= 0 &&
                      timeline.dayIndexByKey.get(`${monthKey(day)}-${pad(day.getDate())}`) ===
                        todayIndex &&
                      "text-rose-300",
                  )}
                >
                  {day.getDate()}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          {tasks.map((task) => {
            const startIndex =
              timeline.dayIndexByKey.get(
                `${monthKey(parseDate(task.start))}-${pad(parseDate(task.start).getDate())}`,
              ) ?? 0;
            const endIndex =
              timeline.dayIndexByKey.get(
                `${monthKey(parseDate(task.end))}-${pad(parseDate(task.end).getDate())}`,
              ) ?? timeline.days.length - 1;
            const meta = TYPE_META[task.type];
            const selected = selectedTaskId === task.id;
            const done = task.subtasks.filter((s) => s.completed).length;
            const percent =
              task.subtasks.length === 0 ? 0 : Math.round((done / task.subtasks.length) * 100);

            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelectAction(task.id)}
                className={cn(
                  "grid w-full border-b border-white/5 text-left transition hover:bg-white/5",
                  selected && "bg-cyan-500/10",
                )}
                style={{ gridTemplateColumns: `${TASK_COLUMN_WIDTH}px minmax(0, 1fr)` }}
              >
                <div className="sticky left-0 z-10 border-r border-white/10 bg-slate-950/90 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs", meta.accent)}>{meta.icon}</span>
                    <span className="truncate text-sm font-medium text-white">{task.title}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span className="capitalize">{task.cadence}</span>
                    <span>·</span>
                    <span>{percent}%</span>
                  </div>
                </div>

                <div className="relative min-h-[56px]">
                  <div
                    className="grid h-full"
                    style={{
                      gridTemplateColumns: `repeat(${timeline.days.length}, ${CELL_WIDTH}px)`,
                    }}
                  >
                    {timeline.days.map((day) => (
                      <div
                        key={`${task.id}-${day.toISOString()}`}
                        className={cn(
                          "border-l border-white/5",
                          (day.getDay() === 0 || day.getDay() === 6) && "bg-white/[0.02]",
                        )}
                      />
                    ))}
                  </div>

                  <div
                    className={cn(
                      "pointer-events-none absolute top-2 flex items-center rounded-lg border bg-gradient-to-r px-2 shadow-lg",
                      meta.gradient,
                      task.status === "done" ? "opacity-60" : "opacity-90",
                      "border-white/20",
                    )}
                    style={{
                      left: `${startIndex * CELL_WIDTH + 2}px`,
                      width: `${Math.max(1, endIndex - startIndex + 1) * CELL_WIDTH - 4}px`,
                      height: "calc(100% - 16px)",
                    }}
                  >
                    <p className="truncate text-[10px] font-semibold text-white">{task.title}</p>
                  </div>

                  {todayIndex >= 0 && (
                    <div
                      className="pointer-events-none absolute inset-y-0 z-10 w-px bg-rose-400/80 shadow-[0_0_10px_rgba(251,113,133,0.8)]"
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
  );
}
