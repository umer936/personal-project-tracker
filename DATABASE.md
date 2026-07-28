# Database Setup & Migration Guide

## Current Status

✅ **Completed:**
- Docker Compose configuration with Postgres 16
- Comprehensive Drizzle ORM schema with:
  - Task categories (health, house, work, prayer, hobbies, sports, etc.)
  - Task templates (repeatable patterns)
  - Tasks with time/count tracking
  - Time sessions (for timer functionality)
  - Daily plans (task picker)
  - Yearly/monthly goals (big picture planning)
  - Debt/credit system for missed tasks
- Database connection setup
- Migration scripts in package.json

🚧 **Next Steps Required:**
- Start Postgres in Docker
- Generate and run migrations
- Create seed data
- Build UI with year/month/day views
- Implement timer component
- Add inline editing
- Create task picker interface

---

## Quick Start

### 1. Start the Database

```powershell
docker-compose up -d postgres
```

This starts Postgres on `localhost:5432` with credentials:
- User: `planner`
- Password: `planner_dev_password`
- Database: `planner`

### 2. Generate Migrations

```powershell
npm run db:generate
```

This creates migration files in `./drizzle` based on the schema.

### 3. Push Schema to Database

```powershell
npm run db:push
```

This applies the schema directly to the database (faster for development).

### 4. Open Drizzle Studio (Optional)

```powershell
npm run db:studio
```

This opens a web UI at `https://local.drizzle.studio` to browse/edit data.

---

## Schema Overview

### Task Categories
Flexible categorization for all life areas:
- Health (exercise, nutrition, sleep)
- House (chores, maintenance, organization)
- Work (projects, meetings, admin)
- Prayer (daily rituals, spiritual practices)
- Hobbies (reading, music, creative projects)
- Sports (weekly activities, training)

### Task Types
Three tracking modes:
1. **Timed** - Track minutes (e.g., "Read 30min daily")
2. **Count** - Track repetitions (e.g., "Exercise 3x weekly")
3. **Boolean** - Simple done/not-done

### Debt/Credit System
- `debtMinutes`: Accumulated missed time
- `creditMinutes`: Extra time banked
- `allowDebt`: Can make up on other days
- `rolloverDebt`: Carries to next week/month

Example: Miss 30min reading Monday → adds 30min debt → can do 60min Wednesday to clear it.

### Time Sessions
Powers the timer feature:
- `startedAt`: When timer begins
- `stoppedAt`: When timer stops
- `durationMinutes`: Total time spent
- Supports pause/resume by creating new sessions

### Daily Plans
Task picker functionality:
- Select which tasks to do today
- Drag to reorder priority
- Mark completed as you go
- Unfinished tasks roll to tomorrow

---

## Database Scripts

```powershell
# Generate migration files from schema changes
npm run db:generate

# Push schema directly (no migration files)
npm run db:push

# Run migration files
npm run db:migrate

# Open Drizzle Studio GUI
npm run db:studio

# Seed initial data (once implemented)
npm run db:seed
```

---

## Environment Variables

`.env.local` (already created):
```
DATABASE_URL=postgresql://planner:planner_dev_password@localhost:5432/planner
```

For Docker container:
```
DATABASE_URL=postgresql://planner:planner_dev_password@postgres:5432/planner
```

---

## Next Implementation Phase

### 1. Seed Data (`lib/db/seed.ts`)
Create initial:
- Task categories with colors/icons
- Common task templates (daily reading, weekly sports, etc.)
- Sample yearly/monthly goals for 2026

### 2. Server Actions (`lib/db/actions.ts`)
CRUD operations for:
- Tasks (create, update, delete, complete)
- Time sessions (start, stop, get active)
- Daily plans (add/remove tasks, reorder)
- Goals (create, update progress)
- Debt management (calculate, payoff)

### 3. UI Components

#### Year View
- Grid of 12 months
- Goal progress bars per category
- Click month → drill down

#### Month View
- Calendar grid with tasks
- Monthly goal progress
- Debt/credit summary
- Click day → drill down

#### Day View
- **Morning**: Task picker (select from templates)
- **Active**: Timer for current task
- **Progress**: Completed tasks list
- **Debt**: Outstanding time to make up

#### Timer Component
```tsx
<Timer
  taskId={taskId}
  targetMinutes={30}
  onComplete={handleComplete}
  allowPause={true}
/>
```

#### Inline Edit
All text should be editable:
- Click to edit (contentEditable)
- Auto-save on blur
- Show save indicator

---

## Docker Commands

```powershell
# Start everything
docker-compose up -d

# Start just database
docker-compose up -d postgres

# View logs
docker-compose logs -f postgres

# Stop everything
docker-compose down

# Wipe database (fresh start)
docker-compose down -v
docker-compose up -d postgres
npm run db:push
```

---

## Migration Path from Current Version

1. **Backup existing data** (if any in `data/database.json`)
2. **Start Postgres**: `docker-compose up -d postgres`
3. **Push schema**: `npm run db:push`
4. **Seed data**: `npm run db:seed` (once implemented)
5. **Update page.tsx** to use new database
6. **Test all features** work with Postgres

---

## Architecture Decisions

### Why Postgres over JSON?
- **Relational integrity**: Foreign keys prevent orphaned data
- **Query performance**: Complex filters/aggregations
- **Concurrent access**: Multiple sessions/devices
- **Data types**: Proper timestamps, JSON columns
- **Migrations**: Schema evolution without data loss

### Why Drizzle over Prisma?
- **TypeScript-first**: Better type inference
- **Lightweight**: Smaller bundle size
- **SQL-like**: More control over queries
- **Fast**: Direct SQL generation

### Why Docker Compose?
- **Isolated environment**: Database doesn't pollute system
- **Reproducible**: Same setup on any machine
- **Easy reset**: `docker-compose down -v` for fresh start
- **Production-ready**: Same setup for deploy

---

## Troubleshooting

### Port 5432 already in use
Another Postgres is running. Either:
- Stop it: `Stop-Service postgresql-x64-16`
- Change port in docker-compose.yml: `5433:5432`

### Connection refused
- Check Postgres is running: `docker-compose ps`
- Check logs: `docker-compose logs postgres`
- Wait for healthcheck: May take 10-20 seconds

### Migration errors
- Drop and recreate: `docker-compose down -v && docker-compose up -d`
- Use push for dev: `npm run db:push` (faster than migrations)

---

## Commit History

```
git log --oneline
```

Each major feature should be its own commit:
- ✅ Initial commit: Basic planner with file-based database
- ✅ Add Docker Compose with Postgres and comprehensive schema
- 🚧 Add seed data and initial categories
- 🚧 Implement Server Actions for database operations
- 🚧 Create year/month/day view components
- 🚧 Add timer component with session tracking
- 🚧 Implement inline editing for all content
- 🚧 Add task picker for daily planning
- 🚧 Implement debt/credit system
- 🚧 Add drag-and-drop task reordering

---

## Resources

- [Drizzle Docs](https://orm.drizzle.team/docs/overview)
- [Postgres Docker](https://hub.docker.com/_/postgres)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Docker Compose Reference](https://docs.docker.com/compose/)
