# Rhythm — Personal Planner

A calm, single-page personal planner with these tabs:

- **Goals** — month-aware life-improvement tracker (daily prayers, monthly exercise/stretch/reading, a YouTube video pipeline, blog, arts & crafts, finance check, a monthly no-work rest day, soccer training, recurring house projects, and any custom goals you add).
- **Follow-ups** — a lightweight follow-up pipeline for people you need to contact.
- **Books** — a reading log where each book stores its total reading time, page count, and a list of quotes/notes (each with an optional page number). Flag a book to **discuss at your next book club** and flip on **Open Book view** to see just those picks.

It also supports:

- **Undo & history** — every change is snapshotted. Hit **↶ Undo** in the top bar to reverse the last edit, or open the **🕑 History** page to review a timeline of changes and **roll back** to any earlier version (the rollback itself can be undone).
- **Deletable, protectable cards** — no goal is permanently locked. Any card can be deleted (with a confirmation), and you can 🔒 **protect** a card so deleting it takes an extra, explicit confirmation — handy for something like a prayer card you never want to lose.
- **Option pools** — for list-style goals (e.g. a monthly *House project*), keep a backlog of candidate options for the whole year, then tap one to log it for the current month — or type a fresh one.
- **Installable PWA** — Rhythm ships a web manifest and a service worker, so you can install it to your home screen and it keeps working offline.

It is a **server-rendered PHP application**. It can run either behind **[FrankenPHP](https://frankenphp.dev/)** / Docker *or* directly on a normal Apache + PHP host. Each account's data is read from and written to JSON files on the server, and the whole app sits behind a **username/password login** so your planner isn't public.

---

## Inspiration

Rhythm borrows ideas from tools I've leaned on over the years:

- **[Trello](https://trello.com/)** — cards you can move between columns (the Follow-ups board).
- **[Kanban](https://en.wikipedia.org/wiki/Kanban_(development))** — the "to do → in progress → done" flow.
- **[timeto.me](https://play.google.com/store/apps/details?id=me.timeto.app)** — a focused Android planner app for repeating goals and daily rhythms.


---

## Accounts & privacy

- **Open registration** — anyone can create an account from the sign-in screen; each account gets its own private planner.
- **Login required** — nothing is visible until you sign in.
- **Demo account** — a built-in `demo` / `demo` account lets people look around without registering. It **resets to the default goals once per calendar day** (lazily, on the first load of a new day).

Passwords are hashed with PHP's `password_hash()`. Credentials live in `data/users.json`; each user's planner lives in `data/stores/<username>.json`.

---

## How data is stored

There is now a **real backend**. Data is stored on the server as JSON:

| Path                          | What it is                                        |
|-------------------------------|---------------------------------------------------|
| `data/users.json`             | Username → password hash (created at runtime)     |
| `data/stores/<username>.json` | One planner file per account                      |

- Data is **shared across your devices/browsers** — it's tied to your account, not your browser.
- New "core" goals shipped in an update are merged into existing accounts automatically without wiping progress — but any core goal you deliberately **delete stays deleted** (tracked in `deletedCoreGoals`).
- Each account also stores its **book log** (`books`) and a capped **change history** (`history`) used for undo / rollback.
- The `data` folder is **git-ignored** and persisted via a Docker named volume so it survives rebuilds.

The starting set of goals is defined in `php/src/seed.php`.

### Future storage: likely moving to SQLite

The whole data layer is isolated behind `php/src/store.php` (`store_read` / `store_write` + the mutation helpers), so the storage backend can change without touching the rest of the app. The plan is to eventually move from per-user JSON files to **SQLite**, and deliberately **not** MySQL:

- **Why SQLite, not MySQL** — on the target host (x10hosting free / cPanel), the only server database is MySQL, and on free shared hosting that means per-host credentials, low connection limits, DBs that can be purged after inactivity, and a network round-trip per request. SQLite is an in-process file on the same disk we already write JSON to, so it needs **no credentials or DB setup**, keeps **one portable codebase** across Docker/FrankenPHP, plain Apache, and x10, and backs up by copying a single file.
- **Why bother at all** — it's not about raw speed (SQLite ≈ JSON for a single user, and both beat a remote MySQL round-trip on shared hosting). The real wins are **transactions / integrity** and keeping writes cheap: today every action rewrites the entire user file (including the growing `history` array), whereas SQLite would write only the changed rows.
- **When MySQL would win instead** — only if the app later needs heavy multi-user concurrency, cross-account relational reporting, background jobs, or a shared API. None of that applies yet.

When that happens, it'll ship with a `.htaccess` guard on the DB file plus `PRAGMA journal_mode=WAL` and `busy_timeout` to stay safe on shared/NFS filesystems.

---

## Run it (Docker + FrankenPHP)

```bash
docker compose up -d --build
```

Then visit http://localhost:3003 and sign in (or click **Try the demo**).

The `docker-compose.yml` mounts a named volume at `/app/data` so accounts and planner data persist across container rebuilds.

---

## Install as an app (PWA)

Rhythm is a Progressive Web App. Open it in a modern browser and use **Install app** (desktop Chrome/Edge) or **Add to Home Screen** (mobile) to run it in its own window. It's backed by:

- `GET /manifest.webmanifest` — the web app manifest (name, colors, icons, start URL).
- `GET /sw.js` — a service worker that caches the app shell so it keeps working offline.
- `GET /icon.svg` — the app icon.

All three are generated by the front controller, so they respect whatever subdirectory the app is hosted under.

---

## Local development (no Docker)

You just need PHP 8.1+ installed. For the production stylesheet, this repo uses the standalone Tailwind CLI binary — no Node.js or npm required.

```bash
./build-tailwind.sh
cd php/public
php -S 127.0.0.1:8099 index.php   # router = front controller
```

On Windows PowerShell:

```powershell
.\build-tailwind.ps1
Set-Location php\public
php -S 127.0.0.1:8099 index.php
```

Then open http://127.0.0.1:8099. (The `index.php` router mimics the Caddy rewrite so clean URLs like `/login` work with the built-in server.)

---

## Hosting under `/proj_tracker/` on a normal PHP website

This repo now includes a top-level `index.php` wrapper and `.htaccess` so it can live directly in a subdirectory such as `/proj_tracker/` on a traditional Apache/PHP site.

- Request `/proj_tracker/`
- Apache rewrites clean URLs like `/proj_tracker/login` and `/proj_tracker/action` to the wrapper entry point
- The app serves its stylesheet at `/proj_tracker/php/public/app.css`
- Planner data is stored on disk under `data`

No Docker is required for that setup.

---

## Project layout (PHP app)

| Path                          | What it is                                                    |
|-------------------------------|---------------------------------------------------------------|
| `php/public/index.php`        | Front controller — routing + the `/action` dispatcher         |
| `php/assets/app.tailwind.css` | Tailwind source file + custom CSS                             |
| `php/public/app.css`          | Built production stylesheet served to the browser             |
| `php/src/helpers.php`         | Date/month math, goal calculations, category/channel metadata |
| `php/src/seed.php`            | Default goals + outreach used to seed accounts / reset demo   |
| `php/src/store.php`           | Per-user JSON data layer (reads/writes + mutations)           |
| `php/src/auth.php`            | Sessions, registration, login/logout, CSRF                    |
| `php/src/views/`              | HTML views: layout, auth screen, main planner, admin, history |
| `php/Caddyfile`               | FrankenPHP server config (front-controller routing)           |
| `Dockerfile`                  | Builds the FrankenPHP image                                   |
| `docker-compose.yml`          | Runs the app on port 3003 with a persistent data volume       |

Styling is built ahead of time with the **standalone Tailwind CLI binary** (`build-tailwind.ps1` / `build-tailwind.sh`), so there is no Node.js/npm runtime dependency.

---

## Backing up or resetting your data

Click **⚙ Data** in the top bar:

- **Export backup (.json)** downloads your entire planner as a dated JSON file (`GET /export`).
- **Reset to default goals** wipes your account's data and re-seeds the starter goals.
