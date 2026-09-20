"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  OutreachChannel,
  OutreachItem,
  OutreachStage,
  Task,
  TaskCadence,
  TaskStatus,
  TaskType,
} from "@/lib/db/schema";
import {
  addSubtask,
  adjustMonthlyProgress,
  createOutreach,
  createTask,
  deleteOutreach,
  deleteTask,
  getOutreachItems,
  getTasks,
  logOutreachTouch,
  setOutreachStage,
  snoozeOutreach,
  updateOutreachFields,
  updateSubtask,
  updateTaskNotes,
  updateTaskStatus,
  updateTaskTitle,
} from "@/lib/db/actions";
import {
  CHANNEL_META,
  STATUS_META,
  TYPE_META,
  cn,
  currentMonthKey,
  daysSince,
  daysUntil,
  formatLongDate,
  formatShortDate,
  startOfDay,
} from "@/lib/ui";
import { Timeline } from "./components/Timeline";

type Tab = "overview" | "timeline" | "outreach";

const ALL_TYPES: TaskType[] = ["video", "prayer", "exercise", "outreach", "admin"];
const STATUS_ORDER: TaskStatus[] = ["planned", "in-progress", "waiting", "postponed", "done"];

function monthPercent(task: Task) {
  const mp = task.monthlyProgress[currentMonthKey()];
  if (!mp || mp.target === 0) return 0;
  return Math.round((mp.completed / mp.target) * 100);
}

function subtaskPercent(task: Task) {
  if (task.subtasks.length === 0) return 0;
  const done = task.subtasks.filter((s) => s.completed).length;
  return Math.round((done / task.subtasks.length) * 100);
}

// ---------- Small building blocks ----------

function ProgressRing({ percent, gradientId }: { percent: number; gradientId: string }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
      <circle
        cx="32"
        cy="32"
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
      <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function TypeBadge({ type }: { type: TaskType }) {
  const meta = TYPE_META[type];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", meta.soft)}>
      <span>{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", meta.soft)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

// ---------- Main ----------

export default function Home() {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("overview");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [outreach, setOutreach] = useState<OutreachItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [selectedTypes, setSelectedTypes] = useState<TaskType[]>(ALL_TYPES);
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddOutreach, setShowAddOutreach] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const reloadTasks = () => getTasks().then(setTasks);
  const reloadOutreach = () => getOutreachItems().then(setOutreach);

  useEffect(() => {
    startTransition(async () => {
      const [t, o] = await Promise.all([getTasks(), getOutreachItems()]);
      setTasks(t);
      setOutreach(o);
      setLoaded(true);
    });
  }, []);

  const allTags = useMemo(
    () => Array.from(new Set(tasks.flatMap((t) => t.tags))).sort((a, b) => a.localeCompare(b)),
    [tasks],
  );

  const visibleTasks = useMemo(
    () =>
      tasks
        .filter((t) => selectedTypes.includes(t.type))
        .filter((t) => selectedTag === "all" || t.tags.includes(selectedTag))
        .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)),
    [tasks, selectedTypes, selectedTag],
  );

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  // Outreach pipeline buckets.
  const isFollowUpDue = (o: OutreachItem) => o.followUpOn !== null && daysUntil(o.followUpOn) <= 0;
  const outreachUrgency = (o: OutreachItem) => {
    if (o.followUpOn) return daysUntil(o.followUpOn); // earlier (more negative) = more urgent
    return daysSince(o.lastAction) * -1 + 999; // no follow-up date → lower priority
  };
  const sortOutreach = (list: OutreachItem[]) =>
    [...list].sort((a, b) => outreachUrgency(a) - outreachUrgency(b));

  const todoItems = sortOutreach(outreach.filter((o) => o.stage === "todo"));
  const waitingItems = sortOutreach(outreach.filter((o) => o.stage === "waiting"));
  const doneItems = outreach.filter((o) => o.stage === "done");
  const followUpDue = sortOutreach(
    outreach.filter((o) => o.stage !== "done" && isFollowUpDue(o)),
  );
  const needsAttention = todoItems.length + followUpDue.length;

  const activeCount = tasks.filter((t) => t.status !== "done").length;
  const avgMonthly =
    tasks.length === 0 ? 0 : Math.round(tasks.reduce((sum, t) => sum + monthPercent(t), 0) / tasks.length);

  const focusTasks = visibleTasks.filter((t) => t.status === "in-progress" || t.status === "waiting");

  // ---------- Mutations ----------
  const withReload = (fn: () => Promise<unknown>, reload: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      await reload();
    });

  const handleStatus = (id: string, status: TaskStatus) =>
    withReload(() => updateTaskStatus(id, status), reloadTasks);
  const handleSubtask = (taskId: string, subtaskId: string, completed: boolean) =>
    withReload(() => updateSubtask(taskId, subtaskId, completed), reloadTasks);
  const handleProgress = (id: string, delta: number) =>
    withReload(() => adjustMonthlyProgress(id, delta), reloadTasks);
  const handleDeleteTask = (id: string) => {
    setSelectedTaskId("");
    withReload(() => deleteTask(id), reloadTasks);
  };
  const handleStage = (id: string, stage: OutreachStage) =>
    withReload(() => setOutreachStage(id, stage), reloadOutreach);
  const handleTouch = (id: string, note?: string, followUpInDays?: number) =>
    withReload(() => logOutreachTouch(id, { note, followUpInDays }), reloadOutreach);
  const handleSnooze = (id: string, days: number) =>
    withReload(() => snoozeOutreach(id, days), reloadOutreach);
  const handleUpdateOutreach = (
    id: string,
    patch: Partial<Pick<OutreachItem, "name" | "topic" | "channel" | "nextAction" | "followUpOn">>,
  ) => withReload(() => updateOutreachFields(id, patch), reloadOutreach);
  const handleDeleteOutreach = (id: string) => withReload(() => deleteOutreach(id), reloadOutreach);

  const today = loaded ? startOfDay(new Date()) : null;

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="animate-float-slow absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="animate-float-slow absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" style={{ animationDelay: "2s" }} />
        <div className="animate-float-slow absolute bottom-10 left-1/3 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" style={{ animationDelay: "4s" }} />
      </div>

      {/* Top navigation */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500 to-fuchsia-500 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/30">
              R
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Rhythm</p>
              <p className="text-[11px] text-slate-500">Personal planner</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 sm:flex">
            {(["overview", "timeline", "outreach"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium capitalize transition",
                  tab === t ? "bg-white/10 text-white shadow-sm" : "text-slate-400 hover:text-slate-200",
                )}
              >
                {t}
                {t === "outreach" && needsAttention > 0 && (
                  <span className="ml-1.5 rounded-full bg-rose-500/80 px-1.5 text-[10px] text-white">{needsAttention}</span>
                )}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => (tab === "outreach" ? setShowAddOutreach(true) : setShowAddTask(true))}
            className="rounded-full bg-linear-to-r from-cyan-500 to-fuchsia-500 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110"
          >
            + New
          </button>
        </div>

        {/* Mobile tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-3 sm:hidden">
          {(["overview", "timeline", "outreach"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium capitalize transition",
                tab === t ? "bg-white/10 text-white" : "text-slate-400",
              )}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {!loaded && <p className="text-sm text-slate-500">Loading your planner…</p>}

        {loaded && tab === "overview" && (
          <div className="animate-fade-in space-y-8">
            {/* Hero */}
            <section>
              <p className="text-sm text-slate-400">{today ? formatLongDate(today) : ""}</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Keep the rhythm going.
              </h1>
            </section>

            {/* Stats */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Active tasks" value={String(activeCount)} hint={`${tasks.length} total`} />
              <StatCard label="Monthly progress" value={`${avgMonthly}%`} hint="avg across tasks" />
              <StatCard label="Your move" value={String(todoItems.length)} hint="contacts to reach out to" />
              <StatCard
                label="Follow-ups due"
                value={String(followUpDue.length)}
                hint={followUpDue.length > 0 ? "needs a nudge" : "all scheduled"}
              />
            </section>

            {/* Today's focus */}
            {focusTasks.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-semibold text-white">Today&apos;s focus</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {focusTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="relative shrink-0">
                        <ProgressRing percent={monthPercent(task)} gradientId={`focus-${task.id}`} />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
                          {monthPercent(task)}%
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <TypeBadge type={task.type} />
                        </div>
                        <p className="mt-1 truncate font-medium text-white">{task.title}</p>
                        <div className="mt-2 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleProgress(task.id, 1)}
                            disabled={isPending}
                            className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-100 transition hover:bg-emerald-500/20"
                          >
                            + Log
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedTaskId(task.id)}
                            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                          >
                            Open
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Filters */}
            <section className="flex flex-wrap items-center gap-2">
              {ALL_TYPES.map((type) => {
                const active = selectedTypes.includes(type);
                const meta = TYPE_META[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setSelectedTypes((cur) =>
                        cur.includes(type) ? cur.filter((x) => x !== type) : [...cur, type],
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition",
                      active ? meta.soft : "border-white/10 bg-white/5 text-slate-500 hover:text-slate-300",
                    )}
                  >
                    {meta.icon} {meta.label}
                  </button>
                );
              })}
              <span className="mx-1 h-4 w-px bg-white/10" />
              <button
                type="button"
                onClick={() => setSelectedTag("all")}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition",
                  selectedTag === "all"
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-slate-500 hover:text-slate-300",
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
                      : "border-white/10 bg-white/5 text-slate-500 hover:text-slate-300",
                  )}
                >
                  #{tag}
                </button>
              ))}
            </section>

            {/* Task grid */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleTasks.map((task) => {
                const meta = TYPE_META[task.type];
                const mPercent = monthPercent(task);
                const sPercent = subtaskPercent(task);
                const mp = task.monthlyProgress[currentMonthKey()];
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setSelectedTaskId(task.id)}
                    className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center justify-between">
                      <TypeBadge type={task.type} />
                      <StatusBadge status={task.status} />
                    </div>
                    <p className="mt-3 font-semibold text-white">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{meta.description}</p>

                    <div className="mt-4 space-y-1">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="capitalize">{task.cadence} target</span>
                        <span className="font-medium text-slate-200">
                          {mp ? `${mp.completed}/${mp.target}` : `0/${task.targetPerMonth}`}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={cn("h-full rounded-full bg-linear-to-r", meta.gradient)}
                          style={{ width: `${mPercent}%` }}
                        />
                      </div>
                    </div>

                    {task.subtasks.length > 0 && (
                      <p className="mt-3 text-xs text-slate-500">
                        {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} steps · {sPercent}%
                      </p>
                    )}

                    {task.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {task.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </section>
          </div>
        )}

        {loaded && tab === "timeline" && (
          <div className="animate-fade-in">
            <Timeline tasks={visibleTasks} selectedTaskId={selectedTaskId} onSelectAction={setSelectedTaskId} />
          </div>
        )}

        {loaded && tab === "outreach" && (
          <div className="animate-fade-in space-y-6">
            {/* Follow-ups due banner */}
            {followUpDue.length > 0 && (
              <section className="rounded-2xl border border-rose-400/30 bg-rose-500/5 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-rose-300">⏰</span>
                  <h2 className="text-sm font-semibold text-rose-200">Follow-ups due</h2>
                  <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-200">
                    {followUpDue.length}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {followUpDue.map((item) => (
                    <OutreachCard
                      key={item.id}
                      item={item}
                      isPending={isPending}
                      onStage={handleStage}
                      onTouch={handleTouch}
                      onSnooze={handleSnooze}
                      onUpdate={handleUpdateOutreach}
                      onDelete={handleDeleteOutreach}
                    />
                  ))}
                </div>
              </section>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <OutreachColumn title="Your move" accent="text-cyan-200" count={todoItems.length}>
                {todoItems.length === 0 ? (
                  <EmptyHint text="Nobody's waiting on you. Nice." />
                ) : (
                  todoItems.map((item) => (
                    <OutreachCard
                      key={item.id}
                      item={item}
                      isPending={isPending}
                      onStage={handleStage}
                      onTouch={handleTouch}
                      onSnooze={handleSnooze}
                      onUpdate={handleUpdateOutreach}
                      onDelete={handleDeleteOutreach}
                    />
                  ))
                )}
              </OutreachColumn>

              <OutreachColumn title="Waiting on them" accent="text-fuchsia-200" count={waitingItems.length}>
                {waitingItems.length === 0 ? (
                  <EmptyHint text="No pending replies." />
                ) : (
                  waitingItems.map((item) => (
                    <OutreachCard
                      key={item.id}
                      item={item}
                      isPending={isPending}
                      onStage={handleStage}
                      onTouch={handleTouch}
                      onSnooze={handleSnooze}
                      onUpdate={handleUpdateOutreach}
                      onDelete={handleDeleteOutreach}
                    />
                  ))
                )}
              </OutreachColumn>
            </div>

            {/* Done (collapsible) */}
            {doneItems.length > 0 && (
              <details className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-300">
                  Done · {doneItems.length}
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {doneItems.map((item) => (
                    <OutreachCard
                      key={item.id}
                      item={item}
                      isPending={isPending}
                      onStage={handleStage}
                      onTouch={handleTouch}
                      onSnooze={handleSnooze}
                      onUpdate={handleUpdateOutreach}
                      onDelete={handleDeleteOutreach}
                    />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Task detail drawer */}
      {selectedTask && (
        <TaskDrawer
          key={selectedTask.id}
          task={selectedTask}
          isPending={isPending}
          onClose={() => setSelectedTaskId("")}
          onStatus={handleStatus}
          onSubtask={handleSubtask}
          onProgress={handleProgress}
          onDelete={handleDeleteTask}
          onSaveNotes={(id, notes) => startTransition(async () => { await updateTaskNotes(id, notes); })}
          onRenameTask={(id, title) => withReload(() => updateTaskTitle(id, title), reloadTasks)}
          onAddSubtask={(id, title) => withReload(() => addSubtask(id, title), reloadTasks)}
        />
      )}

      {showAddTask && (
        <AddTaskDialog
          isPending={isPending}
          onClose={() => setShowAddTask(false)}
          onCreate={(input) =>
            startTransition(async () => {
              await createTask(input);
              await reloadTasks();
              setShowAddTask(false);
            })
          }
        />
      )}

      {showAddOutreach && (
        <AddOutreachDialog
          isPending={isPending}
          onClose={() => setShowAddOutreach(false)}
          onCreate={(input) =>
            startTransition(async () => {
              await createOutreach(input);
              await reloadOutreach();
              setShowAddOutreach(false);
            })
          }
        />
      )}
    </main>
  );
}

// ---------- Outreach ----------

function OutreachColumn({
  title,
  accent,
  count,
  children,
}: {
  title: string;
  accent: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className={cn("text-sm font-semibold", accent)}>{title}</h2>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-white/10 py-6 text-center text-sm text-slate-500">
      {text}
    </p>
  );
}

function FollowUpChip({ item }: { item: OutreachItem }) {
  if (item.stage === "done") {
    return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">closed</span>;
  }
  if (!item.followUpOn) {
    return (
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">
        {daysSince(item.lastAction)}d since
      </span>
    );
  }
  const until = daysUntil(item.followUpOn);
  if (until < 0) {
    return (
      <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] text-rose-200">
        {Math.abs(until)}d overdue
      </span>
    );
  }
  if (until === 0) {
    return <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">due today</span>;
  }
  return (
    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">
      in {until}d
    </span>
  );
}

const outreachBtn = "rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200 transition hover:bg-white/10 disabled:opacity-50";

function OutreachCard({
  item,
  isPending,
  onStage,
  onTouch,
  onSnooze,
  onUpdate,
  onDelete,
}: {
  item: OutreachItem;
  isPending: boolean;
  onStage: (id: string, stage: OutreachStage) => void;
  onTouch: (id: string, note?: string, followUpInDays?: number) => void;
  onSnooze: (id: string, days: number) => void;
  onUpdate: (
    id: string,
    patch: Partial<Pick<OutreachItem, "name" | "topic" | "channel" | "nextAction" | "followUpOn">>,
  ) => void;
  onDelete: (id: string) => void;
}) {
  const channel = CHANNEL_META[item.channel];
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [topic, setTopic] = useState(item.topic);
  const [channelValue, setChannelValue] = useState<OutreachChannel>(item.channel);
  const [nextAction, setNextAction] = useState(item.nextAction);
  const [followUpOn, setFollowUpOn] = useState(item.followUpOn ?? "");

  const overdue = item.stage !== "done" && item.followUpOn !== null && daysUntil(item.followUpOn) <= 0;

  if (editing) {
    return (
      <div className="rounded-xl border border-cyan-400/30 bg-slate-950/60 p-3">
        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className={cn(inputClass, "py-1.5")} placeholder="Name" />
          <input value={topic} onChange={(e) => setTopic(e.target.value)} className={cn(inputClass, "py-1.5")} placeholder="Topic" />
          <div className="flex gap-2">
            <select value={channelValue} onChange={(e) => setChannelValue(e.target.value as OutreachChannel)} className={cn(inputClass, "py-1.5")}>
              {(Object.keys(CHANNEL_META) as OutreachChannel[]).map((c) => (
                <option key={c} value={c} className="bg-slate-900">
                  {CHANNEL_META[c].icon} {CHANNEL_META[c].label}
                </option>
              ))}
            </select>
            <input type="date" value={followUpOn} onChange={(e) => setFollowUpOn(e.target.value)} className={cn(inputClass, "py-1.5")} />
          </div>
          <textarea value={nextAction} onChange={(e) => setNextAction(e.target.value)} className={cn(inputClass, "min-h-16 py-1.5")} placeholder="Next action" />
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              onUpdate(item.id, {
                name,
                topic,
                channel: channelValue,
                nextAction,
                followUpOn: followUpOn || null,
              });
              setEditing(false);
            }}
            className="flex-1 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/20"
          >
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className={outreachBtn}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border bg-black/20 p-3", overdue ? "border-rose-400/30" : "border-white/10")}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm" title={channel.label}>
            {channel.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{item.name}</p>
            <p className="truncate text-xs text-slate-400">{item.topic}</p>
          </div>
        </div>
        <FollowUpChip item={item} />
      </div>

      <p className="mb-2 text-xs leading-relaxed text-slate-300">{item.nextAction}</p>

      <p className="mb-3 text-[11px] text-slate-500">
        Last touch {daysSince(item.lastAction)}d ago
        {item.followUpOn && item.stage !== "done" && <> · follow up {formatShortDate(item.followUpOn)}</>}
        {item.history.length > 0 && <> · {item.history.length} logged</>}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {item.stage === "done" ? (
          <button type="button" disabled={isPending} onClick={() => onStage(item.id, "todo")} className={outreachBtn}>
            ↩ Reopen
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onTouch(item.id)}
              className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50"
              title="Record that you reached out; schedules a follow-up in 5 days"
            >
              ✓ Log touch
            </button>
            {item.stage === "waiting" && (
              <>
                <button type="button" disabled={isPending} onClick={() => onSnooze(item.id, 3)} className={outreachBtn}>
                  +3d
                </button>
                <button type="button" disabled={isPending} onClick={() => onSnooze(item.id, 7)} className={outreachBtn}>
                  +7d
                </button>
              </>
            )}
            <button
              type="button"
              disabled={isPending}
              onClick={() => onStage(item.id, item.stage === "todo" ? "waiting" : "todo")}
              className={outreachBtn}
            >
              {item.stage === "todo" ? "→ Waiting" : "→ Your move"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onStage(item.id, "done")}
              className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              Done
            </button>
          </>
        )}
        <button type="button" onClick={() => setEditing(true)} className={cn(outreachBtn, "ml-auto")}>
          Edit
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onDelete(item.id)}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-400 transition hover:border-rose-400/30 hover:text-rose-200 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ---------- Task drawer ----------

function TaskDrawer({
  task,
  isPending,
  onClose,
  onStatus,
  onSubtask,
  onProgress,
  onDelete,
  onSaveNotes,
  onRenameTask,
  onAddSubtask,
}: {
  task: Task;
  isPending: boolean;
  onClose: () => void;
  onStatus: (id: string, status: TaskStatus) => void;
  onSubtask: (taskId: string, subtaskId: string, completed: boolean) => void;
  onProgress: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
  onSaveNotes: (id: string, notes: string) => void;
  onRenameTask: (id: string, title: string) => void;
  onAddSubtask: (id: string, title: string) => void;
}) {
  const meta = TYPE_META[task.type];
  const [notes, setNotes] = useState(task.notes);
  const [title, setTitle] = useState(task.title);
  const [newSubtask, setNewSubtask] = useState("");
  const mp = task.monthlyProgress[currentMonthKey()];
  const mPercent = monthPercent(task);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="animate-fade-in relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-slate-950/95 p-6">
        <div className="mb-4 flex items-start justify-between gap-2">
          <TypeBadge type={task.type} />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-400 transition hover:text-white"
          >
            Close ✕
          </button>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== task.title && onRenameTask(task.id, title)}
          className="w-full rounded-lg border border-transparent bg-transparent text-xl font-bold text-white outline-none transition focus:border-white/10 focus:bg-white/5 focus:px-2"
        />
        <p className="mt-1 text-sm text-slate-500">{meta.description}</p>

        {/* Monthly progress */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300 capitalize">{task.cadence} progress</span>
            <span className="font-semibold text-white">
              {mp ? `${mp.completed}/${mp.target}` : `0/${task.targetPerMonth}`}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <div className={cn("h-full rounded-full bg-linear-to-r", meta.gradient)} style={{ width: `${mPercent}%` }} />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onProgress(task.id, -1)}
              disabled={isPending}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200 transition hover:bg-white/10"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => onProgress(task.id, 1)}
              disabled={isPending}
              className="flex-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-100 transition hover:bg-emerald-500/20"
            >
              + Log progress
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="mt-5">
          <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_ORDER.map((s) => {
              const sm = STATUS_META[s];
              const active = task.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onStatus(task.id, s)}
                  disabled={isPending}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-medium transition",
                    active ? sm.soft : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200",
                  )}
                >
                  {sm.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subtasks */}
        <div className="mt-5">
          <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">Steps</p>
          <div className="space-y-2">
            {task.subtasks.map((subtask) => (
              <label
                key={subtask.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition",
                  subtask.completed
                    ? "border-emerald-400/20 bg-emerald-500/10"
                    : "border-white/10 bg-white/5 hover:border-white/20",
                )}
              >
                <input
                  type="checkbox"
                  checked={subtask.completed}
                  onChange={() => onSubtask(task.id, subtask.id, !subtask.completed)}
                  disabled={isPending}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 accent-emerald-500"
                />
                <div className="flex-1">
                  <p className={cn("text-sm font-medium", subtask.completed ? "text-slate-400 line-through" : "text-white")}>
                    {subtask.title}
                  </p>
                  {subtask.note && <p className="mt-0.5 text-xs text-slate-500">{subtask.note}</p>}
                </div>
              </label>
            ))}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newSubtask.trim()) {
                onAddSubtask(task.id, newSubtask);
                setNewSubtask("");
              }
            }}
          >
            <input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              placeholder="Add a step…"
              className="flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-1.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
            />
            <button
              type="submit"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10"
            >
              Add
            </button>
          </form>
        </div>

        {/* Notes */}
        <div className="mt-5">
          <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">Notes</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => onSaveNotes(task.id, notes)}
            placeholder="Add notes…"
            className="min-h-28 w-full rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
          />
        </div>

        <button
          type="button"
          onClick={() => onDelete(task.id)}
          disabled={isPending}
          className="mt-6 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400 transition hover:border-rose-400/30 hover:text-rose-200"
        >
          Delete task
        </button>
      </aside>
    </div>
  );
}

// ---------- Add task dialog ----------

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-fade-in relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 transition hover:text-white">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50";

function AddTaskDialog({
  onClose,
  onCreate,
  isPending,
}: {
  onClose: () => void;
  onCreate: (input: { title: string; type: TaskType; cadence: TaskCadence; tags: string[]; targetPerMonth: number }) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("video");
  const [cadence, setCadence] = useState<TaskCadence>("monthly");
  const [tags, setTags] = useState("");
  const [target, setTarget] = useState(1);

  return (
    <Modal title="New task" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onCreate({
            title,
            type,
            cadence,
            tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
            targetPerMonth: Math.max(1, target),
          });
        }}
      >
        <div>
          <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">Title</label>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. August video: idea → upload" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as TaskType)} className={inputClass}>
              {ALL_TYPES.map((t) => (
                <option key={t} value={t} className="bg-slate-900">
                  {TYPE_META[t].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">Cadence</label>
            <select value={cadence} onChange={(e) => setCadence(e.target.value as TaskCadence)} className={inputClass}>
              {(["one-off", "daily", "weekly", "monthly"] as TaskCadence[]).map((c) => (
                <option key={c} value={c} className="bg-slate-900">
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">Monthly target</label>
            <input type="number" min={1} value={target} onChange={(e) => setTarget(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">Tags (comma sep)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="health, recurring" className={inputClass} />
          </div>
        </div>
        <button
          type="submit"
          disabled={isPending || !title.trim()}
          className="w-full rounded-lg bg-linear-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          Create task
        </button>
      </form>
    </Modal>
  );
}

function AddOutreachDialog({
  onClose,
  onCreate,
  isPending,
}: {
  onClose: () => void;
  onCreate: (input: {
    name: string;
    topic: string;
    nextAction: string;
    channel: OutreachChannel;
    followUpInDays: number | null;
  }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [channel, setChannel] = useState<OutreachChannel>("email");
  const [followUpInDays, setFollowUpInDays] = useState(5);

  return (
    <Modal title="New contact" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onCreate({ name, topic, nextAction, channel, followUpInDays: followUpInDays || null });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">Name</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. redacted" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">Channel</label>
            <select value={channel} onChange={(e) => setChannel(e.target.value as OutreachChannel)} className={inputClass}>
              {(Object.keys(CHANNEL_META) as OutreachChannel[]).map((c) => (
                <option key={c} value={c} className="bg-slate-900">
                  {CHANNEL_META[c].icon} {CHANNEL_META[c].label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">Topic</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Redacted" className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">Next action</label>
          <textarea value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Send update and ask for timeline." className={cn(inputClass, "min-h-20")} />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">
            Remind me to follow up in (days)
          </label>
          <input
            type="number"
            min={0}
            value={followUpInDays}
            onChange={(e) => setFollowUpInDays(Number(e.target.value))}
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-slate-500">Set to 0 for no reminder.</p>
        </div>
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="w-full rounded-lg bg-linear-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          Add contact
        </button>
      </form>
    </Modal>
  );
}
