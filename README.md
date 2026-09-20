# Rhythm — Personal Planner

A calm, single-page personal planner with two tabs:

- **Goals** — month-aware life-improvement tracker (daily prayers, monthly exercise/stretch/reading, a YouTube video pipeline, blog, arts & crafts, finance check, a monthly no-work rest day, soccer training, and any custom goals you add).
- **Outreach** — a lightweight follow-up pipeline for people you need to contact.

It is a **server-rendered PHP application** served by **[FrankenPHP](https://frankenphp.dev/)** (a single, self-contained PHP app server built on Caddy). Each account's data is read from and written to JSON files on the server, and the whole app sits behind a **username/password login** so your planner isn't public.


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
- New locked "core" goals shipped in an update are merged into existing accounts automatically without wiping progress.
- The `data/` folder is **git-ignored** and persisted via a Docker named volume so it survives rebuilds.

The starting set of goals is defined in `php/src/seed.php`.

---

## Run it (Docker + FrankenPHP)

```bash
docker compose up -d --build
```

Then visit http://localhost:3003 and sign in (or click **Try the demo**).

The `docker-compose.yml` mounts a named volume at `/app/data` so accounts and planner data persist across container rebuilds.

---

## Local development (no Docker)

You just need PHP 8.1+ installed:

```bash
cd php/public
php -S 127.0.0.1:8099 index.php   # router = front controller
```

Then open http://127.0.0.1:8099. (The `index.php` router mimics the Caddy rewrite so clean URLs like `/login` work with the built-in server.)

---

## Project layout (PHP app)

| Path                        | What it is                                                     |
|-----------------------------|----------------------------------------------------------------|
| `php/public/index.php`      | Front controller — routing + the `/action` dispatcher          |
| `php/public/app.css`        | Global styling + Tailwind-v4 gradient bridges + animations     |
| `php/src/helpers.php`       | Date/month math, goal calculations, category/channel metadata  |
| `php/src/seed.php`          | Default goals + outreach used to seed accounts / reset demo    |
| `php/src/store.php`         | Per-user JSON data layer (reads/writes + mutations)            |
| `php/src/auth.php`          | Sessions, registration, login/logout, CSRF                     |
| `php/src/views/`            | HTML views: layout, auth screen, main planner                  |
| `php/Caddyfile`             | FrankenPHP server config (front-controller routing)            |
| `Dockerfile`                | Builds the FrankenPHP image                                     |
| `docker-compose.yml`        | Runs the app on port 3003 with a persistent data volume        |

Styling uses the **Tailwind Play CDN** at runtime, so there is no build step.

---

## Backing up or resetting your data

Click **⚙ Data** in the top bar:

- **Export backup (.json)** downloads your entire planner as a dated JSON file (`GET /export`).
- **Reset to default goals** wipes your account's data and re-seeds the starter goals.
