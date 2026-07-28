# Task Rhythm Planner

A Next.js dashboard for planning work as a Gantt-style task board with:

- **Database-driven architecture** (file-based JSON with Server Actions)
- **Gantt timeline** with type/tag filters and auto-scroll to today
- **Task notes** and subtask checkboxes with real-time persistence  
- **Outreach inbox** (waiting on me / waiting on them + age tracking)
- **Creative gradient design** with animated backgrounds and responsive layout

## Run locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3003](http://localhost:3003).

> Port 3003 is used to avoid colliding with other local projects on 3000/3001/3002.

## Architecture

### Database layer
- `lib/db/schema.ts` — TypeScript types for tasks and outreach items
- `lib/db/seed.ts` — Initial data populated on first run
- `lib/db/actions.ts` — Server Actions for reads/writes
- `data/database.json` — JSON file created automatically (gitignored)

### UI
- `app/page.tsx` — Client component fetching from Server Actions
- Narrower max-width (1280px) for better responsiveness
- Gradient-based design with animated background orbs
- Horizontal-scroll Gantt with sticky task labels

## Common commands

```bash
npm run lint
npm run build
```
