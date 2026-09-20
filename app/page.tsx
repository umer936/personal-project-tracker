"use client";

import { useEffect, useState, useTransition } from "react";
import type {
  Goal,
  GoalCategory,
  GoalStep,
  GoalType,
  OutreachChannel,
  OutreachItem,
  OutreachStage,
} from "@/lib/db/schema";
import {
  adjustMonthCount,
  addMonthEntry,
  createGoal,
  createOutreach,
  deleteGoal,
  deleteOutreach,
  exportDatabase,
  getGoals,
  getOutreachItems,
  importDatabase,
  logOutreachTouch,
  removeMonthEntry,
  resetDatabase,
  setDailyCount,
  setOutreachStage,
  snoozeOutreach,
  toggleProjectStep,
  updateOutreachFields,
} from "@/lib/db/store";
import {
  CATEGORY_META,
  CHANNEL_META,
  addMonth,
  cn,
  currentMonthKey,
  dayKey,
  daysInMonth,
  daysSince,
  daysUntil,
  formatLongDate,
  formatShortDate,
  monthLabel,
  startOfDay,
  todayKey,
} from "@/lib/ui";

type Tab = "goals" | "outreach";

const CATEGORIES: GoalCategory[] = [
  "prayer",
  "exercise",
  "stretch",
  "reading",
  "video",
  "blog",
  "craft",
  "finance",
  "rest",
  "soccer",
  "other",
];

// ---------- Goal math ----------

function stepIdFor(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function dailyDone(goal: Goal, monthKey: string) {
  return Object.entries(goal.dailyLog).reduce(
    (sum, [k, v]) => (k.startsWith(monthKey) ? sum + v : sum),
    0,
  );
}

function dailyTarget(goal: Goal, monthKey: string) {
  return daysInMonth(monthKey) * (goal.perDay ?? 1);
}

function countDone(goal: Goal, monthKey: string) {
  const state = goal.months[monthKey];
  if (goal.logEntries) return state?.entries?.length ?? 0;
  return state?.count ?? 0;
}

function countEntries(goal: Goal, monthKey: string): string[] {
  return goal.months[monthKey]?.entries ?? [];
}

function projectSteps(goal: Goal, monthKey: string): GoalStep[] {
  return (
    goal.months[monthKey]?.steps ??
    (goal.stepTemplate ?? []).map((title) => ({ id: stepIdFor(title), title, completed: false }))
  );
}

// Fraction of the selected month that has elapsed (for pacing).
function monthElapsedFraction(monthKey: string) {
  const cur = currentMonthKey();
  if (monthKey < cur) return 1;
  if (monthKey > cur) return 0;
  const today = new Date();
  return today.getDate() / daysInMonth(monthKey);
}

// A goal's completion percent for the month.
function goalPercent(goal: Goal, monthKey: string) {
  if (goal.type === "daily") {
    const t = dailyTarget(goal, monthKey);
    return t === 0 ? 0 : Math.round((dailyDone(goal, monthKey) / t) * 100);
  }
  if (goal.type === "count") {
    const t = goal.monthlyTarget ?? 1;
    return t === 0 ? 0 : Math.min(100, Math.round((countDone(goal, monthKey) / t) * 100));
  }
  const steps = projectSteps(goal, monthKey);
  if (steps.length === 0) return 0;
  return Math.round((steps.filter((s) => s.completed).length / steps.length) * 100);
}

// Whether a goal is keeping pace with the elapsed month.
function goalOnPace(goal: Goal, monthKey: string) {
  const elapsed = monthElapsedFraction(monthKey);
  if (goal.type === "daily") {
    // expected completions so far = perDay * elapsedDays
    const elapsedDays =
      monthKey < currentMonthKey()
        ? daysInMonth(monthKey)
        : monthKey > currentMonthKey()
          ? 0
          : new Date().getDate();
    const expected = (goal.perDay ?? 1) * elapsedDays;
    return dailyDone(goal, monthKey) >= expected;
  }
  const target = goal.type === "count" ? goal.monthlyTarget ?? 1 : projectSteps(goal, monthKey).length;
  const done = goal.type === "count" ? countDone(goal, monthKey) : projectSteps(goal, monthKey).filter((s) => s.completed).length;
  return done >= Math.ceil(target * elapsed);
}

// ---------- Small building blocks ----------

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
      <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function CategoryBadge({ category }: { category: GoalCategory }) {
  const meta = CATEGORY_META[category];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", meta.soft)}>
      <span>{meta.icon}</span>
      {meta.label}
    </span>
  );
}

function PaceChip({ onPace }: { onPace: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium",
        onPace ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200",
      )}
    >
      {onPace ? "on pace" : "behind"}
    </span>
  );
}

function Bar({ percent, gradient }: { percent: number; gradient: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className={cn("h-full rounded-full bg-linear-to-r", gradient)} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

// ---------- Main ----------

export default function Home() {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("goals");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [outreach, setOutreach] = useState<OutreachItem[]>([]);
  const [monthKey, setMonthKey] = useState<string>(currentMonthKey);
  const [loaded, setLoaded] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddOutreach, setShowAddOutreach] = useState(false);
  const [showData, setShowData] = useState(false);

  const reloadGoals = () => getGoals().then(setGoals);
  const reloadOutreach = () => getOutreachItems().then(setOutreach);

  useEffect(() => {
    startTransition(async () => {
      const [g, o] = await Promise.all([getGoals(), getOutreachItems()]);
      setGoals(g);
      setOutreach(o);
      setLoaded(true);
    });
  }, []);

  const withReload = (fn: () => Promise<unknown>, reload: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      await reload();
    });

  // Goal handlers
  const handleSetDay = (goalId: string, dateKey: string, count: number) =>
    withReload(() => setDailyCount(goalId, dateKey, count), reloadGoals);
  const handleCount = (goalId: string, delta: number) =>
    withReload(() => adjustMonthCount(goalId, monthKey, delta), reloadGoals);
  const handleAddEntry = (goalId: string, label: string) =>
    withReload(() => addMonthEntry(goalId, monthKey, label), reloadGoals);
  const handleRemoveEntry = (goalId: string, index: number) =>
    withReload(() => removeMonthEntry(goalId, monthKey, index), reloadGoals);
  const handleStep = (goalId: string, stepId: string) =>
    withReload(() => toggleProjectStep(goalId, monthKey, stepId), reloadGoals);
  const handleDeleteGoal = (goalId: string) => withReload(() => deleteGoal(goalId), reloadGoals);

  // Outreach handlers
  const isFollowUpDue = (o: OutreachItem) => o.followUpOn !== null && daysUntil(o.followUpOn) <= 0;
  const outreachUrgency = (o: OutreachItem) =>
    o.followUpOn ? daysUntil(o.followUpOn) : daysSince(o.lastAction) * -1 + 999;
  const sortOutreach = (list: OutreachItem[]) => [...list].sort((a, b) => outreachUrgency(a) - outreachUrgency(b));
  const todoItems = sortOutreach(outreach.filter((o) => o.stage === "todo"));
  const waitingItems = sortOutreach(outreach.filter((o) => o.stage === "waiting"));
  const doneItems = outreach.filter((o) => o.stage === "done");
  const followUpDue = sortOutreach(outreach.filter((o) => o.stage !== "done" && isFollowUpDue(o)));
  const needsAttention = todoItems.length + followUpDue.length;

  const handleStage = (id: string, stage: OutreachStage) =>
    withReload(() => setOutreachStage(id, stage), reloadOutreach);
  const handleTouch = (id: string, note?: string, followUpInDays?: number) =>
    withReload(() => logOutreachTouch(id, { note, followUpInDays }), reloadOutreach);
  const handleSnooze = (id: string, days: number) => withReload(() => snoozeOutreach(id, days), reloadOutreach);
  const handleUpdateOutreach = (
    id: string,
    patch: Partial<Pick<OutreachItem, "name" | "topic" | "channel" | "nextAction" | "followUpOn">>,
  ) => withReload(() => updateOutreachFields(id, patch), reloadOutreach);
  const handleDeleteOutreach = (id: string) => withReload(() => deleteOutreach(id), reloadOutreach);

  // Goal-derived stats for the selected month
  const prayer = goals.find((g) => g.category === "prayer");
  const prayerPercent = prayer ? goalPercent(prayer, monthKey || currentMonthKey()) : 0;
  const todayPrayers = prayer ? prayer.dailyLog[todayKey()] ?? 0 : 0;
  const onPaceCount = goals.filter((g) => goalOnPace(g, monthKey || currentMonthKey())).length;
  const isCurrentMonth = monthKey === currentMonthKey();
  const daysLeft = isCurrentMonth && monthKey ? daysInMonth(monthKey) - new Date().getDate() : 0;
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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Brand */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500 to-fuchsia-500 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/30">
              R
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-white">Rhythm</p>
              <p className="hidden text-[11px] text-slate-500 sm:block">Personal planner</p>
            </div>
          </div>

          {/* Tabs — centered */}
          <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
            {(["goals", "outreach"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "relative rounded-full px-3 py-1.5 text-sm font-medium capitalize transition sm:px-4",
                  tab === t
                    ? "bg-linear-to-r from-cyan-500/20 to-fuchsia-500/20 text-white shadow-sm ring-1 ring-white/10"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                {t}
                {t === "outreach" && needsAttention > 0 && (
                  <span className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500/90 px-1 text-[10px] font-semibold text-white">
                    {needsAttention}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Actions — grouped right */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowData(true)}
              title="Backup / restore your data"
              aria-label="Backup and restore data"
              className="flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <span aria-hidden>⚙</span>
              <span className="hidden sm:inline">Data</span>
            </button>

            <button
              type="button"
              onClick={() => (tab === "outreach" ? setShowAddOutreach(true) : setShowAddGoal(true))}
              className="flex h-9 items-center gap-1.5 rounded-full bg-linear-to-r from-cyan-500 to-fuchsia-500 px-3.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110 sm:px-4"
            >
              <span aria-hidden className="text-base leading-none">+</span>
              <span className="hidden sm:inline">{tab === "outreach" ? "New contact" : "New goal"}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {!loaded && <p className="text-sm text-slate-500">Loading your planner…</p>}

        {loaded && tab === "goals" && monthKey && (
          <div className="animate-fade-in space-y-8">
            {/* Hero + month switcher */}
            <section className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">{today ? formatLongDate(today) : ""}</p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">Life goals</h1>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setMonthKey(addMonth(monthKey, -1))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10">
                  ‹
                </button>
                <div className="min-w-40 text-center text-sm font-semibold text-white">{monthLabel(monthKey)}</div>
                <button type="button" onClick={() => setMonthKey(addMonth(monthKey, 1))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10">
                  ›
                </button>
                {!isCurrentMonth && (
                  <button type="button" onClick={() => setMonthKey(currentMonthKey())} className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100 transition hover:bg-cyan-500/20">
                    This month
                  </button>
                )}
              </div>
            </section>

            {/* Stats */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Prayers this month" value={`${prayerPercent}%`} hint={prayer ? `${dailyDone(prayer, monthKey)} / ${dailyTarget(prayer, monthKey)}` : "—"} />
              <StatCard label="Today's prayers" value={`${todayPrayers}/${prayer?.perDay ?? 5}`} hint={isCurrentMonth ? "so far today" : "current day"} />
              <StatCard label="On pace" value={`${onPaceCount}/${goals.length}`} hint="goals keeping up" />
              <StatCard label="Days left" value={isCurrentMonth ? String(daysLeft) : "—"} hint={isCurrentMonth ? "this month" : monthLabel(monthKey)} />
            </section>

            {/* Goal cards */}
            <section className="grid gap-5 lg:grid-cols-2">
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  monthKey={monthKey}
                  isCurrentMonth={isCurrentMonth}
                  isPending={isPending}
                  onSetDay={handleSetDay}
                  onCount={handleCount}
                  onAddEntry={handleAddEntry}
                  onRemoveEntry={handleRemoveEntry}
                  onStep={handleStep}
                  onDelete={handleDeleteGoal}
                />
              ))}
            </section>
          </div>
        )}

        {loaded && tab === "outreach" && (
          <div className="animate-fade-in space-y-6">
            {followUpDue.length > 0 && (
              <section className="rounded-2xl border border-rose-400/30 bg-rose-500/5 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-rose-300">⏰</span>
                  <h2 className="text-sm font-semibold text-rose-200">Follow-ups due</h2>
                  <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-200">{followUpDue.length}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {followUpDue.map((item) => (
                    <OutreachCard key={item.id} item={item} isPending={isPending} onStage={handleStage} onTouch={handleTouch} onSnooze={handleSnooze} onUpdate={handleUpdateOutreach} onDelete={handleDeleteOutreach} />
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
                    <OutreachCard key={item.id} item={item} isPending={isPending} onStage={handleStage} onTouch={handleTouch} onSnooze={handleSnooze} onUpdate={handleUpdateOutreach} onDelete={handleDeleteOutreach} />
                  ))
                )}
              </OutreachColumn>

              <OutreachColumn title="Waiting on them" accent="text-fuchsia-200" count={waitingItems.length}>
                {waitingItems.length === 0 ? (
                  <EmptyHint text="No pending replies." />
                ) : (
                  waitingItems.map((item) => (
                    <OutreachCard key={item.id} item={item} isPending={isPending} onStage={handleStage} onTouch={handleTouch} onSnooze={handleSnooze} onUpdate={handleUpdateOutreach} onDelete={handleDeleteOutreach} />
                  ))
                )}
              </OutreachColumn>
            </div>

            {doneItems.length > 0 && (
              <details className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-300">Done · {doneItems.length}</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {doneItems.map((item) => (
                    <OutreachCard key={item.id} item={item} isPending={isPending} onStage={handleStage} onTouch={handleTouch} onSnooze={handleSnooze} onUpdate={handleUpdateOutreach} onDelete={handleDeleteOutreach} />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {showAddGoal && (
        <AddGoalDialog
          isPending={isPending}
          onClose={() => setShowAddGoal(false)}
          onCreate={(input) =>
            startTransition(async () => {
              await createGoal(input);
              await reloadGoals();
              setShowAddGoal(false);
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

      {showData && (
        <DataDialog
          onClose={() => setShowData(false)}
          onChanged={() => {
            startTransition(async () => {
              await Promise.all([reloadGoals(), reloadOutreach()]);
            });
          }}
        />
      )}
    </main>
  );
}

// ---------- Goal card ----------

function GoalCard({
  goal,
  monthKey,
  isCurrentMonth,
  isPending,
  onSetDay,
  onCount,
  onAddEntry,
  onRemoveEntry,
  onStep,
  onDelete,
}: {
  goal: Goal;
  monthKey: string;
  isCurrentMonth: boolean;
  isPending: boolean;
  onSetDay: (goalId: string, dateKey: string, count: number) => void;
  onCount: (goalId: string, delta: number) => void;
  onAddEntry: (goalId: string, label: string) => void;
  onRemoveEntry: (goalId: string, index: number) => void;
  onStep: (goalId: string, stepId: string) => void;
  onDelete: (goalId: string) => void;
}) {
  const meta = CATEGORY_META[goal.category];
  const percent = goalPercent(goal, monthKey);
  const onPace = goalOnPace(goal, monthKey);

  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <CategoryBadge category={goal.category} />
          <h3 className="mt-2 text-lg font-semibold text-white">{goal.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <PaceChip onPace={onPace} />
          {!goal.locked && (
            <button
              type="button"
              onClick={() => onDelete(goal.id)}
              disabled={isPending}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-500 transition hover:border-rose-400/30 hover:text-rose-200"
              title="Delete goal"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {goal.type === "daily" && (
        <DailyGoalBody goal={goal} monthKey={monthKey} isCurrentMonth={isCurrentMonth} isPending={isPending} onSetDay={onSetDay} percent={percent} meta={meta} />
      )}
      {goal.type === "count" && (
        <CountGoalBody goal={goal} monthKey={monthKey} isPending={isPending} onCount={onCount} onAddEntry={onAddEntry} onRemoveEntry={onRemoveEntry} percent={percent} meta={meta} />
      )}
      {goal.type === "project" && (
        <ProjectGoalBody goal={goal} monthKey={monthKey} isPending={isPending} onStep={onStep} percent={percent} meta={meta} />
      )}
    </div>
  );
}

function DailyGoalBody({
  goal,
  monthKey,
  isCurrentMonth,
  isPending,
  onSetDay,
  percent,
  meta,
}: {
  goal: Goal;
  monthKey: string;
  isCurrentMonth: boolean;
  isPending: boolean;
  onSetDay: (goalId: string, dateKey: string, count: number) => void;
  percent: number;
  meta: (typeof CATEGORY_META)[GoalCategory];
}) {
  const perDay = goal.perDay ?? 1;
  const total = daysInMonth(monthKey);
  const done = dailyDone(goal, monthKey);
  const target = dailyTarget(goal, monthKey);
  const todayNum = new Date().getDate();
  const todayCount = goal.dailyLog[todayKey()] ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-slate-400">Month completion</span>
          <span className="font-medium text-slate-200">{done} / {target} · {percent}%</span>
        </div>
        <Bar percent={percent} gradient={meta.gradient} />
      </div>

      {isCurrentMonth && (
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-slate-500">Today</span>
            <span className="text-xs text-slate-400">{todayCount}/{perDay}</span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: perDay }).map((_, i) => {
              const filled = i < todayCount;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isPending}
                  onClick={() => onSetDay(goal.id, todayKey(), filled && todayCount === i + 1 ? i : i + 1)}
                  className={cn(
                    "h-8 flex-1 rounded-lg border text-xs transition",
                    filled
                      ? cn("border-transparent bg-linear-to-r text-white", meta.gradient)
                      : "border-white/10 bg-white/5 text-slate-500 hover:bg-white/10",
                  )}
                  title={`Mark ${i + 1} done`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Month heatmap — read-only history. Prayers can't be caught up,
          so past days are locked; you can only log today (above). */}
      <div>
        <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">
          {isCurrentMonth ? "This month · log today only" : "Month history"}
        </p>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: total }).map((_, idx) => {
            const day = idx + 1;
            const key = dayKey(monthKey, day);
            const count = goal.dailyLog[key] ?? 0;
            const frac = count / perDay;
            const isToday = isCurrentMonth && day === todayNum;
            const isPast = isCurrentMonth ? day < todayNum : monthKey < currentMonthKey();
            // Missed past days (nothing logged) are shown in red — they can't be recovered.
            const missed = isPast && count === 0;
            return (
              <div
                key={day}
                title={`${monthKey}-${String(day).padStart(2, "0")}: ${count}/${perDay}`}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md border text-[10px]",
                  isToday ? "border-cyan-400/60" : "border-white/10",
                  frac === 0 && !missed && "bg-white/5 text-slate-600",
                  missed && "border-rose-500/30 bg-rose-500/10 text-rose-300/70",
                  frac > 0 && frac < 1 && "bg-emerald-500/30 text-emerald-100",
                  frac >= 1 && "bg-emerald-500/70 text-white",
                )}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CountGoalBody({
  goal,
  monthKey,
  isPending,
  onCount,
  onAddEntry,
  onRemoveEntry,
  percent,
  meta,
}: {
  goal: Goal;
  monthKey: string;
  isPending: boolean;
  onCount: (goalId: string, delta: number) => void;
  onAddEntry: (goalId: string, label: string) => void;
  onRemoveEntry: (goalId: string, index: number) => void;
  percent: number;
  meta: (typeof CATEGORY_META)[GoalCategory];
}) {
  const target = goal.monthlyTarget ?? 1;
  const done = countDone(goal, monthKey);
  const unit = goal.unit ?? "times";
  const complete = done >= target;
  const [entry, setEntry] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold text-white">
            {done}
            <span className="text-lg text-slate-500"> / {target}</span>
          </p>
          <p className="text-xs text-slate-400">{unit} this month</p>
        </div>
        {complete ? (
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-200">Done ✓</span>
        ) : (
          <span className="text-sm text-slate-400">{percent}%</span>
        )}
      </div>

      <Bar percent={percent} gradient={meta.gradient} />

      {goal.logEntries ? (
        <div className="space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!entry.trim()) return;
              onAddEntry(goal.id, entry);
              setEntry("");
            }}
          >
            <input
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder={goal.category === "reading" ? "Book you read…" : "What you made…"}
              className={cn(inputClass, "py-1.5")}
            />
            <button
              type="submit"
              disabled={isPending || !entry.trim()}
              className={cn("shrink-0 rounded-lg border border-transparent bg-linear-to-r px-4 py-1.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-40", meta.gradient)}
            >
              + Log
            </button>
          </form>

          {countEntries(goal, monthKey).length > 0 && (
            <ul className="space-y-1.5">
              {countEntries(goal, monthKey).map((label, i) => (
                <li key={`${label}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
                  <span className="min-w-0 truncate text-sm text-slate-200">{label}</span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onRemoveEntry(goal.id, i)}
                    className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-500 transition hover:border-rose-400/30 hover:text-rose-200 disabled:opacity-40"
                    title="Remove"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" disabled={isPending || done === 0} onClick={() => onCount(goal.id, -1)} className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-40">
            −
          </button>
          <button type="button" disabled={isPending} onClick={() => onCount(goal.id, 1)} className={cn("flex-1 rounded-lg border border-transparent bg-linear-to-r px-4 py-1.5 text-sm font-medium text-white transition hover:brightness-110", meta.gradient)}>
            + Log {unit.replace(/s$/, "")}
          </button>
        </div>
      )}
    </div>
  );
}

function ProjectGoalBody({
  goal,
  monthKey,
  isPending,
  onStep,
  percent,
  meta,
}: {
  goal: Goal;
  monthKey: string;
  isPending: boolean;
  onStep: (goalId: string, stepId: string) => void;
  percent: number;
  meta: (typeof CATEGORY_META)[GoalCategory];
}) {
  const steps = projectSteps(goal, monthKey);
  const elapsed = Math.round(monthElapsedFraction(monthKey) * 100);
  const behind = percent < elapsed;

  return (
    <div className="space-y-4">
      {/* Pace bar with an "elapsed" marker */}
      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-slate-400">
            {monthKey === currentMonthKey() ? `Day ${new Date().getDate()} of ${daysInMonth(monthKey)}` : monthLabel(monthKey)}
          </span>
          <span className={cn("font-medium", behind ? "text-amber-200" : "text-emerald-200")}>
            {percent}% done · {elapsed}% of month
          </span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
          <div className={cn("h-full rounded-full bg-linear-to-r", meta.gradient)} style={{ width: `${percent}%` }} />
          <div className="absolute inset-y-0 w-0.5 bg-white/70" style={{ left: `${elapsed}%` }} title="Where you should be" />
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((step) => (
          <label
            key={step.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition",
              step.completed ? "border-emerald-400/20 bg-emerald-500/10" : "border-white/10 bg-white/5 hover:border-white/20",
            )}
          >
            <input type="checkbox" checked={step.completed} onChange={() => onStep(goal.id, step.id)} disabled={isPending} className="h-4 w-4 rounded border-white/20 accent-emerald-500" />
            <span className={cn("text-sm font-medium", step.completed ? "text-slate-400 line-through" : "text-white")}>{step.title}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ---------- Outreach ----------

function OutreachColumn({ title, accent, count, children }: { title: string; accent: string; count: number; children: React.ReactNode }) {
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
  return <p className="rounded-xl border border-dashed border-white/10 py-6 text-center text-sm text-slate-500">{text}</p>;
}

function FollowUpChip({ item }: { item: OutreachItem }) {
  if (item.stage === "done") {
    return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">closed</span>;
  }
  if (!item.followUpOn) {
    return <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">{daysSince(item.lastAction)}d since</span>;
  }
  const until = daysUntil(item.followUpOn);
  if (until < 0) {
    return <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] text-rose-200">{Math.abs(until)}d overdue</span>;
  }
  if (until === 0) {
    return <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">due today</span>;
  }
  return <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">in {until}d</span>;
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
  onUpdate: (id: string, patch: Partial<Pick<OutreachItem, "name" | "topic" | "channel" | "nextAction" | "followUpOn">>) => void;
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
              onUpdate(item.id, { name, topic, channel: channelValue, nextAction, followUpOn: followUpOn || null });
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
          <span className="text-sm" title={channel.label}>{channel.icon}</span>
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{item.name}</p>
            <p className="truncate text-xs text-slate-400">{item.topic}</p>
          </div>
        </div>
        <FollowUpChip item={item} />
      </div>

      <p className="mb-2 whitespace-pre-line text-xs leading-relaxed text-slate-300">{item.nextAction}</p>

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
            <button type="button" disabled={isPending} onClick={() => onTouch(item.id)} className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-50" title="Record that you reached out; schedules a follow-up in 5 days">
              ✓ Log touch
            </button>
            {item.stage === "waiting" && (
              <>
                <button type="button" disabled={isPending} onClick={() => onSnooze(item.id, 3)} className={outreachBtn}>+3d</button>
                <button type="button" disabled={isPending} onClick={() => onSnooze(item.id, 7)} className={outreachBtn}>+7d</button>
              </>
            )}
            <button type="button" disabled={isPending} onClick={() => onStage(item.id, item.stage === "todo" ? "waiting" : "todo")} className={outreachBtn}>
              {item.stage === "todo" ? "→ Waiting" : "→ Your move"}
            </button>
            <button type="button" disabled={isPending} onClick={() => onStage(item.id, "done")} className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50">
              Done
            </button>
          </>
        )}
        <button type="button" onClick={() => setEditing(true)} className={cn(outreachBtn, "ml-auto")}>Edit</button>
        <button type="button" disabled={isPending} onClick={() => onDelete(item.id)} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-400 transition hover:border-rose-400/30 hover:text-rose-200 disabled:opacity-50">
          Delete
        </button>
      </div>
    </div>
  );
}

// ---------- Dialogs ----------

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-fade-in relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 transition hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50";

function AddGoalDialog({
  onClose,
  onCreate,
  isPending,
}: {
  onClose: () => void;
  onCreate: (input: {
    title: string;
    category: GoalCategory;
    type: GoalType;
    perDay?: number;
    monthlyTarget?: number;
    unit?: string;
    logEntries?: boolean;
  }) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<GoalCategory>("other");
  const [type, setType] = useState<GoalType>("count");
  const [perDay, setPerDay] = useState(5);
  const [monthlyTarget, setMonthlyTarget] = useState(3);
  const [unit, setUnit] = useState("sessions");
  const [logEntries, setLogEntries] = useState(false);

  return (
    <Modal title="New goal" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onCreate({
            title,
            category,
            type,
            perDay: type === "daily" ? Math.max(1, perDay) : undefined,
            monthlyTarget: type === "count" ? Math.max(1, monthlyTarget) : undefined,
            unit: type === "count" ? unit : undefined,
            logEntries: type === "count" ? logEntries : undefined,
          });
        }}
      >
        <div>
          <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">Title</label>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Meditate daily" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as GoalCategory)} className={inputClass}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-slate-900">
                  {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as GoalType)} className={inputClass}>
              <option value="daily" className="bg-slate-900">Daily (N/day)</option>
              <option value="count" className="bg-slate-900">Monthly count</option>
              <option value="project" className="bg-slate-900">Project (steps)</option>
            </select>
          </div>
        </div>

        {type === "daily" && (
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">Times per day</label>
            <input type="number" min={1} value={perDay} onChange={(e) => setPerDay(Number(e.target.value))} className={inputClass} />
          </div>
        )}
        {type === "count" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">Monthly target</label>
              <input type="number" min={1} value={monthlyTarget} onChange={(e) => setMonthlyTarget(Number(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">Unit</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="sessions" className={inputClass} />
            </div>
          </div>
        )}
        {type === "count" && (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
            <input type="checkbox" checked={logEntries} onChange={(e) => setLogEntries(e.target.checked)} className="h-4 w-4 rounded border-white/20 accent-cyan-500" />
            Note what I did each time (e.g. book title, what I made)
          </label>
        )}
        {type === "project" && (
          <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-400">
            Creates a monthly project with steps: Idea → Draft → Finish. It&apos;s paced against the calendar.
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || !title.trim()}
          className="w-full rounded-lg bg-linear-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          Create goal
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
  onCreate: (input: { name: string; topic: string; nextAction: string; channel: OutreachChannel; followUpInDays: number | null }) => void;
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
          <label className="mb-1 block text-xs uppercase tracking-widest text-slate-500">Remind me to follow up in (days)</label>
          <input type="number" min={0} value={followUpInDays} onChange={(e) => setFollowUpInDays(Number(e.target.value))} className={inputClass} />
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

function DataDialog({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const handleExport = async () => {
    setBusy(true);
    try {
      const json = await exportDatabase();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rhythm-planner-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage({ kind: "ok", text: "Backup downloaded." });
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      const text = await file.text();
      const error = await importDatabase(text);
      if (error) {
        setMessage({ kind: "error", text: error });
      } else {
        onChanged();
        setMessage({ kind: "ok", text: "Data imported. You're all set." });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    if (!window.confirm("Reset all data back to the default goals? This can't be undone.")) return;
    setBusy(true);
    setMessage(null);
    (async () => {
      await resetDatabase();
      onChanged();
      setMessage({ kind: "ok", text: "Data reset to defaults." });
      setBusy(false);
    })();
  };

  return (
    <Modal title="Backup & restore" onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-slate-400">
          Your planner is stored only in this browser. Export a backup file you can keep or move to
          another device, and import it to restore.
        </p>

        <div className="space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleExport}
            className="w-full rounded-lg bg-linear-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            ⬇ Export backup (.json)
          </button>

          <label className={cn("block w-full cursor-pointer rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-center text-sm font-medium text-slate-200 transition hover:bg-white/10", busy && "pointer-events-none opacity-50")}>
            ⬆ Import backup…
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {message && (
          <p
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
              message.kind === "ok"
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                : "border-rose-400/30 bg-rose-500/10 text-rose-200",
            )}
          >
            {message.text}
          </p>
        )}

        <div className="border-t border-white/10 pt-4">
          <button
            type="button"
            disabled={busy}
            onClick={handleReset}
            className="w-full rounded-lg border border-rose-400/20 bg-rose-500/5 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-50"
          >
            Reset to default goals
          </button>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Importing replaces everything currently stored. Consider exporting first.
          </p>
        </div>
      </div>
    </Modal>
  );
}
