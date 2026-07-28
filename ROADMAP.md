# Roadmap — Task Rhythm Planner

Ideas captured after the initial build. Pick them up whenever you're ready.

---

## 1 · Database-backed tasks

Right now tasks live in a hard-coded array in `app/page.tsx`. Replacing that with a proper
data layer would let you add, edit, and delete tasks without touching code.

**Suggested approach**
- Add [Drizzle ORM](https://orm.drizzle.team/) + a local SQLite file (via `better-sqlite3`)
  for zero-infrastructure local dev.
- Add a Next.js Server Action for each mutation: `createTask`, `updateTask`, `deleteTask`,
  `updateSubtask`, `logRecurringSession`.
- Swap the static `TASKS` array for a `getTasksForMonth(month)` server-side fetch.

**Tables to start with**
- `tasks` — core metadata (title, type, cadence, dates, tags)
- `subtasks` — belongs to a task, has a `completed_at` timestamp
- `task_notes` — one row per task, updated freely
- `recurring_sessions` — one row per logged session (prayer, exercise, etc.)

---

## 2 · Drag-and-drop scheduling

Allow you to drag a task bar in the Gantt view to reschedule it without opening an edit form.

**Suggested approach**
- Use [dnd-kit](https://dndkit.com/) — it works well with pointer and touch events.
- Constrain drag to the horizontal axis only; snap to day boundaries.
- On drop, fire a Server Action to update `task.start` and `task.end`.
- Show a "ghost" of the original position while dragging so it's easy to abort.

---

## 3 · Recurring task auto-generation

Today recurring targets live in `task.monthlyProgress`. A proper engine would generate
session slots automatically and let you log or skip them.

**Suggested approach**
- Store a `recurrence_rule` on each task (cadence + target count per period).
- On the first render of a new month, run a server function that materializes the expected
  session rows in `recurring_sessions` (status: `pending`).
- The Gantt row shows completed/total from live rows, not static JSON.
- Each session has a status: `completed`, `missed`, `postponed`.

---

## 4 · Full task detail editor

A slide-over or modal panel where you can create and edit a task with all fields, instead
of editing code.

**Suggested approach**
- Add a `TaskForm` component with controlled inputs for title, type, dates, cadence,
  target count, and tags.
- Render it as a `<dialog>` element so the background stays interactive.
- Use a Server Action for save; optimistically update the client list.
- Support adding/removing subtasks inline in the same form.

---

## 5 · Monthly analytics charts

Replace the current progress table with bar/line charts so you can spot trends at a glance.

**Suggested approach**
- Use [Recharts](https://recharts.org/) — it's light, composable, and works with Tailwind.
- One stacked bar chart per task type across the last six months.
- A completion-rate line chart overlaid on the bar to show trend direction.
- A "streak" metric — consecutive months at or above target.

**Suggested chart components to build**
- `<MonthlyBarChart type="video" data={stats} />`
- `<RecurringStreakBadge type="prayer" sessions={sessions} />`
- `<InboxAgeHeatmap contacts={outreachItems} />`

---

## 6 · Inbox / outreach aging view

A dedicated view for email and contact tracking, showing how many days something has sat
in your bucket vs. theirs.

**Suggested approach**
- Add an `outreach_items` table: contact, subject, last-action date, whose court it's in,
  next action, deadline.
- A two-column Kanban: "Waiting on me" / "Waiting on them".
- Age is computed live from `last_action_date` so you see the real number every day.
- Items in your court older than 3 days glow red.

---

## 7 · YouTube video pipeline view

A swimlane board specifically for video projects with the fixed stages you move through.

**Stages**: Brainstorm → Outline → Record → Edit → Thumbnail + Title → Upload

**Suggested approach**
- Filter tasks with `type === "video"` and render them in a horizontal swimlane, one card
  per stage.
- Moving a card updates the active subtask index (equivalent to checking the current step).
- Show an "Ideas backlog" column for videos that haven't been scoped yet.
- Add a "publish date" field so you can see which month each video is targeting.

---

## Notes

- All ideas above are additive — the current version keeps working as-is while you layer
  them in one at a time.
- Each section is roughly ordered from lowest to highest complexity.
- If you add a database, do sections 1 and 3 together since recurring auto-generation
  needs the session table.
