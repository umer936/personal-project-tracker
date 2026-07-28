# Task Rhythm Planner

A comprehensive Next.js planning system with multi-level views (Year/Month/Day), time tracking, debt/credit system, and Docker-based Postgres database.

## 🎯 Features (In Progress)

### ✅ Implemented
- **Database Infrastructure**
  - Docker Compose with Postgres 16
  - Comprehensive Drizzle ORM schema
  - Multiple task categories (health, house, work, prayer, hobbies, sports)
  - Task templates with recurrence patterns
  - Debt/credit system for missed tasks
  - Time session tracking for timer
  - Daily plans for task picking
  - Yearly/monthly goals

### 🚧 In Development
- **Multi-Level Views**
  - Year view (big picture, 12 months overview)
  - Month view (calendar with daily tasks)
  - Day view (task picker + active timer + progress)
  
- **Time-Based Tasks**
  - Timer component (start/stop/pause)
  - Target duration tracking (e.g., "30min reading")
  - Debt accumulation for missed time
  - Credit banking for extra time
  
- **Task Flexibility**
  - Make up missed tasks on different days
  - Rollover debt to next week/month
  - Count-based tasks (e.g., "3x weekly")
  - Boolean tasks (done/not-done)
  
- **Inline Editing**
  - Edit all text in-place
  - Auto-save on blur
  - Add new tasks/goals directly
  - Edit notes in cards

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- Node.js 20+ (already have 20.15.0)

### 1. Start the Database

```powershell
docker-compose up -d postgres
```

### 2. Set Up Schema

```powershell
npm install
npm run db:push
```

### 3. Run Development Server

```powershell
npm run dev
```

Then open [http://localhost:3003](http://localhost:3003).

> **Note**: The current UI is from the previous version. See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for building the new multi-view system.

## 📊 Architecture

### Database (Postgres + Drizzle)
```
┌─ Task Categories (health, house, work, etc.)
├─ Task Templates (repeatable patterns)
├─ Tasks (actual instances)
│  ├─ Time Sessions (timer data)
│  └─ Daily Plans (picked tasks)
├─ Yearly Goals (big picture)
└─ Monthly Goals (breakdown)
```

### Task Types
1. **Timed** - Track minutes (e.g., "Read 30min daily")
2. **Count** - Track repetitions (e.g., "Exercise 3x weekly")  
3. **Boolean** - Simple checkbox

### Debt/Credit System
- Miss a task → accumulate debt minutes
- Extra time → build credit minutes
- Make up debt on any day (if `allowDebt` = true)
- Debt rolls over to next period (if `rolloverDebt` = true)

**Example Flow:**
```
Monday:    Read 30min ❌ (missed) → +30 debt
Tuesday:   Read 30min ✅ (on time)
Wednesday: Read 60min ✅ (30 + 30 debt) → debt cleared!
```

## 📂 Project Structure

```
├── lib/db/
│   ├── schema.ts       # Drizzle schema (all tables)
│   ├── index.ts        # Database connection
│   ├── seed.ts         # Initial data (TODO)
│   └── actions.ts      # Server Actions (TODO)
├── app/
│   ├── page.tsx        # Main dashboard (needs rebuild)
│   ├── year/           # Year view (TODO)
│   ├── month/          # Month view (TODO)
│   └── day/            # Day view (TODO)
├── components/
│   ├── Timer.tsx       # Timer component (TODO)
│   ├── TaskPicker.tsx  # Daily task selector (TODO)
│   └── InlineEdit.tsx  # Editable text (TODO)
├── docker-compose.yml  # Postgres + app services
├── Dockerfile          # App container
└── drizzle.config.ts   # Drizzle configuration
```

## 🛠️ Database Commands

```powershell
# Generate migration files
npm run db:generate

# Push schema directly (faster for dev)
npm run db:push

# Run migrations
npm run db:migrate

# Open Drizzle Studio GUI
npm run db:studio

# Seed initial data (once implemented)
npm run db:seed
```

## 📖 Documentation

- [DATABASE.md](./DATABASE.md) - Complete database setup guide
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) - Feature implementation roadmap
- [ROADMAP.md](./ROADMAP.md) - Original feature ideas
- [CHANGES.md](./CHANGES.md) - Previous refactoring notes

## 🎨 Planned Views

### Year View
- 12-month grid layout
- Progress bars per category
- Yearly goal tracking
- Click month → drill into Month View

### Month View
- Calendar with daily task indicators
- Monthly goal progress
- Debt/credit summary
- Click day → drill into Day View

### Day View
```
┌─ Morning: Task Picker ────────┐
│ ☐ Read 30min                  │
│ ☐ Exercise                    │
│ ☐ Prayer times (5)            │
│ ☐ Work project X              │
└────────────────────────────────┘

┌─ Active: Timer ───────────────┐
│ 📖 Reading                    │
│ ⏱️  15:23 / 30:00             │
│ [Pause] [Stop] [Complete]     │
└────────────────────────────────┘

┌─ Completed Today ─────────────┐
│ ✅ Morning prayer (5min)      │
│ ✅ Email responses (20min)    │
└────────────────────────────────┘

┌─ Debt to Pay Off ─────────────┐
│ 📚 Reading: 60min owed        │
│ 🏃 Exercise: 1 session owed   │
└────────────────────────────────┘
```

## 🔄 Git Workflow

Commits made so far:
```
✅ Initial commit: Basic planner with file-based database
✅ Add Docker Compose with Postgres and comprehensive schema
```

Next commits planned:
```
🚧 Add seed data with initial categories and templates
🚧 Implement Server Actions for CRUD operations
🚧 Build Year view component
🚧 Build Month view component
🚧 Build Day view with task picker
🚧 Add Timer component with session tracking
🚧 Implement inline editing everywhere
🚧 Add debt/credit calculation and payoff UI
```

## 🐛 Troubleshooting

### Database won't start
```powershell
docker-compose logs postgres
```

### Reset everything
```powershell
docker-compose down -v
docker-compose up -d postgres
npm run db:push
```

### Port conflicts
Edit `docker-compose.yml` to change ports if 5432 is in use.

## 📝 Current Status

**Phase 1: Infrastructure** ✅
- Docker setup complete
- Database schema designed
- Migration tools configured

**Phase 2: Seed Data** 🚧
- Need to create initial categories
- Need to create common task templates
- Need to set up 2026 goals

**Phase 3: UI Rebuild** 🚧
- Current UI is from previous version
- Needs complete rebuild for new architecture
- See IMPLEMENTATION.md for detailed plan

## 🤝 Contributing

This is a personal planning tool. Implementation continues in phases as documented in IMPLEMENTATION.md.
