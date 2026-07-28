# Implementation Roadmap

Complete guide for building the multi-view planning system with all requested features.

---

## Phase 1: Database & Infrastructure ✅

**Status**: Complete  
**Commit**: `Add Docker Compose with Postgres and comprehensive schema`

### Completed
- ✅ Docker Compose with Postgres 16
- ✅ Drizzle ORM schema with all tables
- ✅ Database connection setup
- ✅ Migration scripts configured
- ✅ Environment variables

### Schema Includes
- Task categories (health, house, work, prayer, hobbies, sports)
- Task templates with recurrence
- Tasks with time/count tracking
- Time sessions for timer
- Daily plans for task picker
- Yearly/monthly goals
- Debt/credit fields

---

## Phase 2: Seed Data & Initial Setup 🚧

**Next Step**: Implement this now

### Tasks
1. Create `lib/db/seed.ts` with:
   - Default task categories with colors/icons
   - Common task templates:
     - Daily reading (30min timed)
     - Weekly sports (1x count)
     - Daily prayer times (boolean checklist)
     - Weekly house chores (count)
     - Monthly work goals (projects)
   
2. Seed 2026 goals:
   - Yearly: "Read 24 books in 2026"
   - Monthly breakdown for current month
   
3. Run seed script:
   ```powershell
   docker-compose up -d postgres
   npm run db:push
   npm run db:seed
   ```

### Example Seed Data

```typescript
// Task Categories
[
  { name: "Health", color: "emerald", icon: "heart" },
  { name: "House", color: "amber", icon: "home" },
  { name: "Work", color: "blue", icon: "briefcase" },
  { name: "Prayer", color: "purple", icon: "mosque" },
  { name: "Hobbies", color: "pink", icon: "book" },
  { name: "Sports", color: "cyan", icon: "dumbbell" },
]

// Task Templates
[
  {
    category: "Hobbies",
    title: "Daily Reading",
    type: "timed",
    targetDuration: 30,
    frequency: "daily",
    allowDebt: true,
    rolloverDebt: true,
  },
  {
    category: "Sports",
    title: "Weekly Exercise",
    type: "count",
    targetCount: 1,
    frequency: "weekly",
    daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
    allowDebt: true,
  },
  {
    category: "Prayer",
    title: "Five Daily Prayers",
    type: "count",
    targetCount: 5,
    frequency: "daily",
    allowDebt: false, // Can't make up missed prayers
  },
]
```

---

## Phase 3: Server Actions 🚧

**File**: `lib/db/actions.ts`

### CRUD Operations

#### Tasks
```typescript
// Create
export async function createTask(data: NewTask): Promise<Task>

// Read
export async function getTasks(filters?: {
  categoryId?: number;
  status?: string;
  dueDate?: Date;
}): Promise<Task[]>

export async function getTask(id: number): Promise<Task | null>

// Update
export async function updateTask(id: number, data: Partial<Task>): Promise<void>
export async function completeTask(id: number): Promise<void>
export async function updateTaskNotes(id: number, notes: string): Promise<void>

// Delete
export async function deleteTask(id: number): Promise<void>
```

#### Time Sessions (Timer)
```typescript
export async function startTimer(taskId: number): Promise<TimeSession>
export async function stopTimer(sessionId: number): Promise<{ duration: number; debtPaid: number }>
export async function getActiveSession(): Promise<TimeSession | null>
export async function getTaskSessions(taskId: number): Promise<TimeSession[]>
```

#### Daily Plans (Task Picker)
```typescript
export async function getDailyPlan(date: Date): Promise<DailyPlan[]>
export async function addToDailyPlan(taskId: number, date: Date): Promise<void>
export async function removeFromDailyPlan(planId: number): Promise<void>
export async function reorderDailyPlan(planId: number, newOrder: number): Promise<void>
export async function completeDailyPlanItem(planId: number): Promise<void>
```

#### Debt Management
```typescript
export async function calculateDebt(taskId: number): Promise<{
  totalDebt: number;
  debtByWeek: Record<string, number>;
}>

export async function payOffDebt(taskId: number, minutes: number): Promise<void>

export async function getDebtSummary(): Promise<{
  category: string;
  tasks: Array<{ id: number; title: string; debtMinutes: number }>;
}[]>
```

#### Goals
```typescript
export async function getYearlyGoals(year: number): Promise<YearlyGoal[]>
export async function getMonthlyGoals(year: number, month: number): Promise<MonthlyGoal[]>
export async function updateGoalProgress(goalId: number, progress: number): Promise<void>
```

---

## Phase 4: Year View Component 🚧

**File**: `app/year/page.tsx`

### Layout
```
┌────────────────────────────────────────────────────┐
│ Year 2026 Overview                          [2025] [2026] [2027] │
├────────────────────────────────────────────────────┤
│ 🎯 Yearly Goals                                    │
│ ▓▓▓▓▓▓▓▓▓▓░░░░░░ Read 24 books (10/24)           │
│ ▓▓▓▓▓▓▓▓░░░░░░░░ 12 YouTube videos (8/12)         │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░ 52 workouts (44/52)             │
├────────────────────────────────────────────────────┤
│ Jan   Feb   Mar   Apr   May   Jun                 │
│ ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐              │
│ │✓✓│  │✓✓│  │✓✓│  │✓ │  │  │  │  │   Health      │
│ └──┘  └──┘  └──┘  └──┘  └──┘  └──┘              │
│                                                    │
│ Jul   Aug   Sep   Oct   Nov   Dec                 │
│ ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐              │
│ │→ │  │  │  │  │  │  │  │  │  │  │   (current)   │
│ └──┘  └──┘  └──┘  └──┘  └──┘  └──┘              │
└────────────────────────────────────────────────────┘
```

### Features
- Grid of 12 month cards
- Click month → navigate to Month View
- Goal progress bars with current/target
- Color-coded by category
- Edit goals inline

### Implementation
```typescript
export default async function YearView({ params }: { params: { year: string } }) {
  const year = parseInt(params.year);
  const goals = await getYearlyGoals(year);
  
  return (
    <div className="year-view">
      <header>
        <h1>Year {year} Overview</h1>
        <YearSelector currentYear={year} />
      </header>
      
      <section className="yearly-goals">
        {goals.map(goal => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
      </section>
      
      <section className="month-grid">
        {Array.from({ length: 12 }, (_, i) => (
          <MonthCard
            key={i}
            year={year}
            month={i + 1}
            onClick={() => router.push(`/month/${year}/${i + 1}`)}
          />
        ))}
      </section>
    </div>
  );
}
```

---

## Phase 5: Month View Component 🚧

**File**: `app/month/[year]/[month]/page.tsx`

### Layout
```
┌────────────────────────────────────────────────────┐
│ ← July 2026 →                         [Year] [Day] │
├────────────────────────────────────────────────────┤
│ 📊 Monthly Goals                                   │
│ ▓▓▓▓▓▓░░░░ Read 120min/week (80/120)              │
│ ▓▓▓▓▓░░░░░ Exercise 3x (2/3)                      │
│                                                    │
│ ⚠️  Debt: 45min reading, 1 workout                 │
├────────────────────────────────────────────────────┤
│ Sun  Mon  Tue  Wed  Thu  Fri  Sat                 │
│      1    2    3    4    5    6                    │
│      ✓    ✓    ✗    ✓    ✓    ✓                   │
│                                                    │
│ 7    8    9   10   11   12   13                    │
│ ✗    ✓    ✓    ✓    ✓    ✗    ✓                   │
│                                                    │
│ 14   15   16   17   18   19   20                   │
│ ✓    ✓    ✓    ✓    ✗    ✓    ✓                   │
│                                                    │
│ 21   22   23   24   25   26   27                   │
│ ✓    ✓    ✓    ✓    ✗    ✓    ✓                   │
│                                                    │
│ 28   29   30   31                                  │
│ →    □    □    □         (today)                   │
└────────────────────────────────────────────────────┘
```

### Features
- Calendar grid with daily indicators
- Click day → navigate to Day View
- Monthly goal progress
- Debt summary with breakdown
- Visual indicators:
  - ✓ = All tasks completed
  - ✗ = Missed tasks (debt added)
  - → = Today
  - □ = Future day

### Implementation
```typescript
export default async function MonthView({
  params,
}: {
  params: { year: string; month: string };
}) {
  const year = parseInt(params.year);
  const month = parseInt(params.month);
  
  const goals = await getMonthlyGoals(year, month);
  const tasks = await getTasks({ /* filter by month */ });
  const debtSummary = await getDebtSummary();
  
  return (
    <div className="month-view">
      <header>
        <MonthNav year={year} month={month} />
        <MonthGoals goals={goals} />
        {debtSummary.totalDebt > 0 && (
          <DebtAlert summary={debtSummary} />
        )}
      </header>
      
      <Calendar
        year={year}
        month={month}
        tasks={tasks}
        onDayClick={(day) => router.push(`/day/${year}/${month}/${day}`)}
      />
    </div>
  );
}
```

---

## Phase 6: Day View Component 🚧

**File**: `app/day/[year]/[month]/[day]/page.tsx`

### Layout
```
┌────────────────────────────────────────────────────┐
│ ← Monday, July 28, 2026 →              [Month] [Year] │
├────────────────────────────────────────────────────┤
│ 🌅 Morning: Pick Your Tasks                       │
│                                                    │
│ Available Tasks (drag to add):                    │
│ [+] Read 30min                                    │
│ [+] Exercise session                              │
│ [+] Work on video project                         │
│ [+] House chores                                  │
│ [+] Prayer times                                  │
│                                                    │
│ Today's Plan (drag to reorder):                   │
│ 1. ☐ Morning prayer                               │
│ 2. ☐ Read 30min                                   │
│ 3. ☐ Work on video project                        │
│ 4. ☐ Exercise session                             │
│ 5. ☐ Evening prayer                               │
├────────────────────────────────────────────────────┤
│ ⏱️  Active: Reading                                │
│ ┌────────────────────────────────────────┐        │
│ │   15:23 / 30:00                        │        │
│ │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░       │        │
│ │   [Pause]  [Stop]  [Complete]          │        │
│ │                                        │        │
│ │   💡 Tip: You have 45min debt to pay  │        │
│ │   Do 75min total to clear it!          │        │
│ └────────────────────────────────────────┘        │
├────────────────────────────────────────────────────┤
│ ✅ Completed Today                                 │
│ ✓ Morning prayer (5min) - 7:15 AM                 │
│ ✓ Email responses (20min) - 9:30 AM               │
├────────────────────────────────────────────────────┤
│ 📉 Outstanding Debt                                │
│ 📚 Reading: 45min owed (3 days missed)            │
│ 🏃 Exercise: 1 session owed (last week)           │
│                                                    │
│ [Pay Off Debt] [View Breakdown]                   │
└────────────────────────────────────────────────────┘
```

### Features
- **Task Picker**: Drag/drop or click to add
- **Timer**: Start/stop/pause with visual progress
- **Completed List**: With timestamps
- **Debt Dashboard**: What's owed and when
- **Inline Editing**: Click any text to edit
- **Auto-refresh**: When timer completes
- **Smart Suggestions**: "Do 75min to clear debt"

### Implementation
```typescript
'use client';

export default function DayView({
  params,
}: {
  params: { year: string; month: string; day: string };
}) {
  const date = new Date(
    parseInt(params.year),
    parseInt(params.month) - 1,
    parseInt(params.day)
  );
  
  const [dailyPlan, setDailyPlan] = useState<DailyPlan[]>([]);
  const [activeSession, setActiveSession] = useState<TimeSession | null>(null);
  const [debtSummary, setDebtSummary] = useState<DebtSummary>({});
  
  // Load data
  useEffect(() => {
    loadDailyPlan();
    loadActiveSession();
    loadDebtSummary();
  }, [date]);
  
  return (
    <div className="day-view">
      <header>
        <DayNav date={date} />
      </header>
      
      <section className="task-picker">
        <h2>Morning: Pick Your Tasks</h2>
        <TaskPicker
          date={date}
          onTaskAdded={handleTaskAdded}
        />
        <DailyPlanList
          plan={dailyPlan}
          onReorder={handleReorder}
          onComplete={handleComplete}
        />
      </section>
      
      {activeSession && (
        <section className="timer-active">
          <Timer
            session={activeSession}
            onStop={handleTimerStop}
            onComplete={handleTimerComplete}
          />
        </section>
      )}
      
      <section className="completed-today">
        <h2>Completed Today</h2>
        <CompletedList date={date} />
      </section>
      
      {Object.keys(debtSummary).length > 0 && (
        <section className="debt-summary">
          <h2>Outstanding Debt</h2>
          <DebtList
            summary={debtSummary}
            onPayOff={handleDebtPayoff}
          />
        </section>
      )}
    </div>
  );
}
```

---

## Phase 7: Timer Component 🚧

**File**: `components/Timer.tsx`

### Features
- Visual countdown with progress bar
- Start/Pause/Stop/Complete buttons
- Elapsed time display
- Target time display
- Debt indicator (if applicable)
- Audio notification on completion
- Background timer (continues if you navigate away)

### Implementation
```typescript
'use client';

import { useState, useEffect, useRef } from 'react';

interface TimerProps {
  session: TimeSession;
  task: Task;
  onStop: () => void;
  onComplete: () => void;
}

export function Timer({ session, task, onStop, onComplete }: TimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const target = task.targetDuration || 0;
  const debt = task.debtMinutes || 0;
  const recommendedTime = target + Math.min(debt, target); // Don't overwhelm
  
  useEffect(() => {
    if (!isPaused) {
      intervalRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 60000); // Every minute
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused]);
  
  const handleComplete = async () => {
    await stopTimer(session.id);
    
    // Calculate debt paid
    const debtPaid = Math.max(0, elapsed - target);
    
    if (debtPaid > 0) {
      await payOffDebt(task.id, debtPaid);
    }
    
    await completeTask(task.id);
    onComplete();
  };
  
  const progress = Math.min((elapsed / target) * 100, 100);
  const debtProgress = debt > 0 ? Math.min(((elapsed - target) / debt) * 100, 100) : 0;
  
  return (
    <div className="timer">
      <div className="timer-header">
        <h3>{task.title}</h3>
        <span className="timer-display">
          {formatMinutes(elapsed)} / {formatMinutes(target)}
        </span>
      </div>
      
      <div className="timer-progress">
        <div
          className="progress-bar-target"
          style={{ width: `${progress}%` }}
        />
        {debt > 0 && (
          <div
            className="progress-bar-debt"
            style={{ width: `${debtProgress}%` }}
          />
        )}
      </div>
      
      {debt > 0 && elapsed < recommendedTime && (
        <div className="timer-hint">
          💡 You have {debt}min debt. Do {recommendedTime}min total to clear it!
        </div>
      )}
      
      <div className="timer-controls">
        <button onClick={() => setIsPaused(!isPaused)}>
          {isPaused ? 'Resume' : 'Pause'}
        </button>
        <button onClick={onStop}>Stop</button>
        <button onClick={handleComplete} disabled={elapsed < target}>
          Complete
        </button>
      </div>
    </div>
  );
}
```

---

## Phase 8: Inline Editing 🚧

**File**: `components/InlineEdit.tsx`

### Features
- Click to edit any text
- Auto-save on blur
- ESC to cancel
- Enter to save (for single-line)
- Visual "saving..." indicator
- Optimistic UI updates

### Implementation
```typescript
'use client';

import { useState, useRef, useEffect } from 'react';

interface InlineEditProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}

export function InlineEdit({
  value,
  onSave,
  multiline = false,
  placeholder = 'Click to edit',
  className = '',
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Save failed:', error);
      setEditValue(value); // Revert
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    } else if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    }
  };
  
  if (isEditing) {
    const Component = multiline ? 'textarea' : 'input';
    
    return (
      <div className={`inline-edit editing ${className}`}>
        <Component
          ref={inputRef as any}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="inline-edit-input"
          placeholder={placeholder}
        />
        {isSaving && <span className="saving-indicator">Saving...</span>}
      </div>
    );
  }
  
  return (
    <div
      className={`inline-edit ${className}`}
      onClick={() => setIsEditing(true)}
    >
      {value || <span className="placeholder">{placeholder}</span>}
    </div>
  );
}
```

---

## Phase 9: Task Picker 🚧

**File**: `components/TaskPicker.tsx`

### Features
- Show available task templates
- Filter by category
- Add to daily plan with click
- Drag-and-drop to reorder
- Quick add custom task
- Show task details on hover

### Implementation
```typescript
'use client';

import { useState } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';

interface TaskPickerProps {
  date: Date;
  onTaskAdded: (taskId: number) => void;
}

export function TaskPicker({ date, onTaskAdded }: TaskPickerProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan[]>([]);
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  
  useEffect(() => {
    loadTemplates();
    loadDailyPlan();
  }, [date]);
  
  const handleAddTask = async (templateId: number) => {
    // Create task from template
    const task = await createTask({
      templateId,
      dueDate: date,
      // ... other fields
    });
    
    // Add to daily plan
    await addToDailyPlan(task.id, date);
    
    onTaskAdded(task.id);
    loadDailyPlan();
  };
  
  const handleReorder = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    // Optimistic update
    const oldIndex = dailyPlan.findIndex(p => p.id === active.id);
    const newIndex = dailyPlan.findIndex(p => p.id === over.id);
    const reordered = arrayMove(dailyPlan, oldIndex, newIndex);
    setDailyPlan(reordered);
    
    // Save to database
    await reorderDailyPlan(active.id as number, newIndex);
  };
  
  return (
    <div className="task-picker">
      <div className="available-tasks">
        <h3>Available Tasks</h3>
        <CategoryFilter
          value={filterCategory}
          onChange={setFilterCategory}
        />
        
        <div className="task-list">
          {templates
            .filter(t => !filterCategory || t.categoryId === filterCategory)
            .map(template => (
              <TaskTemplateCard
                key={template.id}
                template={template}
                onAdd={() => handleAddTask(template.id)}
              />
            ))}
        </div>
        
        <QuickAddTask date={date} onAdded={loadDailyPlan} />
      </div>
      
      <div className="daily-plan">
        <h3>Today's Plan</h3>
        <DndContext onDragEnd={handleReorder}>
          <SortableList items={dailyPlan}>
            {dailyPlan.map((plan, index) => (
              <DailyPlanItem
                key={plan.id}
                plan={plan}
                index={index}
                onComplete={() => handleComplete(plan.id)}
                onRemove={() => handleRemove(plan.id)}
              />
            ))}
          </SortableList>
        </DndContext>
      </div>
    </div>
  );
}
```

---

## Phase 10: Debt System Implementation 🚧

### Debt Accumulation
- Runs daily at midnight (cron job)
- For each active task template:
  - Check if task was completed yesterday
  - If not, add `targetDuration` to task's `debtMinutes`
  - If `rolloverDebt` is false, reset debt at period end

### Debt Payment
- When timer stops:
  - Calculate: `timeOver = actualDuration - targetDuration`
  - If `timeOver > 0`: subtract from `debtMinutes`
  - If `timeOver > debtMinutes`: add to `creditMinutes`

### Debt Display
- Day View: "You have 45min reading debt"
- Month View: "3 days missed this month"
- Year View: Progress bars account for debt

### Implementation
```typescript
// lib/db/debt.ts

export async function accumulateDebt() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  const templates = await getActiveTemplates();
  
  for (const template of templates) {
    const completed = await getCompletedTasks({
      templateId: template.id,
      date: yesterday,
    });
    
    if (completed.length === 0 && template.allowDebt) {
      // Find or create ongoing task
      const task = await getOrCreateTaskForTemplate(template, yesterday);
      
      // Add debt
      await updateTask(task.id, {
        debtMinutes: task.debtMinutes + (template.targetDuration || 0),
      });
    }
  }
}

export async function payOffDebt(taskId: number, minutesPaid: number) {
  const task = await getTask(taskId);
  if (!task) return;
  
  const remaining = Math.max(0, task.debtMinutes - minutesPaid);
  const credit = minutesPaid > task.debtMinutes
    ? minutesPaid - task.debtMinutes
    : 0;
  
  await updateTask(taskId, {
    debtMinutes: remaining,
    creditMinutes: task.creditMinutes + credit,
  });
}
```

---

## Phase 11: Final Polish 🚧

### Navigation
- Breadcrumbs: Year > Month > Day
- Quick jump: Date picker in header
- Keyboard shortcuts:
  - `Y` = Year view
  - `M` = Month view
  - `D` = Today
  - `T` = Start timer
  - `Space` = Pause/Resume timer

### Responsive Design
- Mobile: Stack views vertically
- Tablet: Side-by-side where possible
- Desktop: Full multi-column layout

### Animations
- Smooth transitions between views
- Timer progress animation
- Task completion celebration
- Debt cleared celebration

### Notifications
- Browser notifications when timer completes
- Daily reminder at set time
- Debt warning when it gets high

---

## Testing Checklist

### Database
- [ ] Start Postgres in Docker
- [ ] Run migrations successfully
- [ ] Seed data populates
- [ ] All relations work
- [ ] Queries perform well

### Views
- [ ] Year view renders all 12 months
- [ ] Month view shows calendar correctly
- [ ] Day view loads daily plan
- [ ] Navigation between views works
- [ ] Inline editing saves correctly

### Timer
- [ ] Timer starts/stops correctly
- [ ] Pause/resume works
- [ ] Completion triggers task update
- [ ] Debt payment calculates correctly
- [ ] Timer persists across page refresh

### Debt System
- [ ] Debt accumulates when task missed
- [ ] Debt displays in all views
- [ ] Paying off debt works
- [ ] Credit accumulates correctly
- [ ] Rollover settings respected

### Task Picker
- [ ] Can add tasks to daily plan
- [ ] Drag-and-drop reordering works
- [ ] Can remove tasks
- [ ] Can complete tasks
- [ ] Quick add works

---

## Performance Optimization

### Database Queries
- Use indexes on foreign keys
- Batch queries where possible
- Use pagination for large lists
- Cache frequently accessed data

### React
- Use React Server Components where possible
- Memoize expensive calculations
- Lazy load views
- Optimize re-renders with `useMemo`/`useCallback`

### Docker
- Use multi-stage build for smaller images
- Enable BuildKit for faster builds
- Mount volumes for dev (hot reload)

---

## Deployment

### Production Setup
1. Use managed Postgres (Railway, Supabase, Neon)
2. Set environment variables in platform
3. Run migrations on deploy
4. Set up backup schedule
5. Monitor performance

### Environment Variables
```
DATABASE_URL=postgresql://user:pass@host:5432/db
NEXTAUTH_URL=https://yourapp.com
NEXTAUTH_SECRET=random_secret_here
```

---

## Summary

This is a comprehensive planning system with:
- ✅ **Multi-level views** (Year/Month/Day)
- ✅ **Time tracking** (Timer with pause/resume)
- ✅ **Debt/credit system** (Make up missed tasks)
- ✅ **Task flexibility** (Timed/count/boolean)
- ✅ **Daily planning** (Task picker with drag-drop)
- ✅ **Inline editing** (Edit everything in-place)
- ✅ **Goal tracking** (Yearly/monthly breakdown)
- ✅ **Multiple categories** (Health, house, work, etc.)

**Estimated Implementation Time**: 40-60 hours total

**Next Immediate Step**: Run seed script to populate database with initial data.
