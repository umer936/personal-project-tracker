# Rhythm — Personal Planner
A calm, single-page personal planner with two tabs:
- **Goals** — month-aware life-improvement tracker (daily prayers, monthly exercise/stretch/reading, a YouTube video pipeline, blog, arts & crafts, finance check, a monthly no-work rest day, soccer training, and any custom goals you add).
- **Outreach** — a lightweight follow-up pipeline for people you need to contact.
It is built with **Next.js** and exported to a **fully static site** — plain HTML/CSS/JS with no server, no database, and no Docker required. You can drop it on any web host (Apache, nginx, a PHP shared host, GitHub Pages, etc.).
---
## How data is stored
There is **no backend**. All your data lives in your **browser''s `localStorage`**. That means:
- Data is saved automatically as you use the app — nothing to run, no file to manage.
- Data is **per-browser / per-device**. Using a different browser or device starts fresh; they do not sync.
- Clearing the site''s data resets the planner.
- New locked "core" goals shipped in an update are added automatically without wiping your existing progress.
The starting set of goals is defined in `lib/db/seed.ts`.
---
## Deploy it (no build tools on the server)
### Option A — Upload the static files (recommended)
1. Build the site (needs Node.js 20+ **only on your machine**, not the server):
   ```bash
   npm install
   npm run build
   ```
2. This produces an **`out/`** folder — a complete static site.
3. Upload the **contents of `out/`** to your web host''s public folder
   (e.g. `public_html/`, `www/`, or wherever your host serves files from).
That is it — open the site in a browser. No Node, no PHP, no Docker needed on the server.
> **Hosting under a subfolder?** The exported asset links are root-relative
> (`/_next/...`), so the app expects to live at the domain root
> (e.g. `https://example.com/`). If you must host it under a subpath
> (e.g. `https://example.com/planner/`), set `basePath: "/planner"` in
> `next.config.ts` and rebuild.
### Option B — Docker (optional convenience)
If you would rather run it in a container, the included `Dockerfile` builds the
static site and serves it with nginx:
```bash
docker compose up -d --build
```
Then visit http://localhost:3003.
---
## Local development
```bash
npm install
npm run dev      # http://localhost:3003
```
---
## Project layout
| Path | What it is |
| --- | --- |
| `app/page.tsx` | The whole UI (Goals + Outreach tabs) |
| `app/layout.tsx`, `app/globals.css` | Root layout and styling (Tailwind CSS v4) |
| `lib/db/schema.ts` | Data model (types) |
| `lib/db/seed.ts` | Default goals used to seed a fresh browser |
| `lib/db/store.ts` | Client-side data layer (reads/writes localStorage) |
| `lib/ui.ts` | UI helpers + category/channel metadata |
| `next.config.ts` | output "export" (static build) |
| `Dockerfile`, `docker-compose.yml` | Optional nginx static hosting |
---
## Resetting or backing up your data
Everything is under one localStorage key: **`rhythm-planner-db-v1`**.
- **Back up:** open the browser dev tools console and run
  `copy(localStorage.getItem("rhythm-planner-db-v1"))` to copy the JSON.
- **Restore:** `localStorage.setItem("rhythm-planner-db-v1", <your JSON string>)`.
- **Reset:** `localStorage.removeItem("rhythm-planner-db-v1")` then refresh.
