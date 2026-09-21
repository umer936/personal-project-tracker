<?php
// Server-side data layer. Each user gets their own JSON file under data/stores.
// Reads and writes go straight to those files (no external database).

declare(strict_types=1);

require_once __DIR__ . '/seed.php';
require_once __DIR__ . '/helpers.php';

const DEMO_USER = 'demo';

function data_dir(): string
{
    // In this repo layout the PHP app lives under php/, but runtime data should
    // live at the repository root: data/. Inside the Docker image, php/ is copied
    // to /app/, so /app/src should still resolve to /app/data.
    $baseDir = dirname(__DIR__);
    $dir = basename($baseDir) === 'php'
        ? dirname($baseDir) . '/data'
        : $baseDir . '/data';
    if (!is_dir($dir . '/stores')) {
        @mkdir($dir . '/stores', 0775, true);
    }
    return $dir;
}

function store_path(string $username): string
{
    return data_dir() . '/stores/' . preg_replace('/[^a-z0-9_-]/', '', strtolower($username)) . '.json';
}

/**
 * Read a user's database, seeding it on first run and merging in any new locked
 * "core" goals. For the demo account, resets to defaults once per calendar day.
 */
function store_read(string $username): array
{
    $path = store_path($username);

    if (!is_file($path)) {
        if ($username === DEMO_USER) {
            $db = demo_database();
            $db['demoResetOn'] = today_key();
        } else {
            $db = default_database();
        }
        store_write($username, $db);
        return $db;
    }

    $raw = file_get_contents($path);
    $db = json_decode((string) $raw, true);
    if (!is_array($db)) {
        $db = default_database();
    }

    $db['goals'] = $db['goals'] ?? [];
    $db['outreachItems'] = $db['outreachItems'] ?? [];
    $db['books'] = $db['books'] ?? [];
    $db['history'] = $db['history'] ?? [];
    $db['deletedCoreGoals'] = $db['deletedCoreGoals'] ?? [];
    $db['settings'] = array_merge(default_settings(), is_array($db['settings'] ?? null) ? $db['settings'] : []);

    // A book's status is derived from finishedOn: empty = currently reading,
    // a date = completed (archived). Migrate any legacy "completed" flag into
    // finishedOn, then drop it so there's a single source of truth.
    foreach ($db['books'] as $i => $book) {
        if (array_key_exists('completed', $book)) {
            if (empty($book['completed'])) {
                $db['books'][$i]['finishedOn'] = '';
            } elseif (empty($book['finishedOn'])) {
                $db['books'][$i]['finishedOn'] = today_key();
            }
            unset($db['books'][$i]['completed']);
        }
        if (!array_key_exists('finishedOn', $book)) {
            $db['books'][$i]['finishedOn'] = '';
        }
    }

    // Demo account: lazily reset to defaults once per day.
    if ($username === DEMO_USER && ($db['demoResetOn'] ?? null) !== today_key()) {
        $db = demo_database();
        $db['demoResetOn'] = today_key();
        store_write($username, $db);
        return $db;
    }

    // Merge in any new core goals shipped in the seed — but never re-add goals
    // the user has deliberately deleted (tracked in deletedCoreGoals).
    $existingIds = array_column($db['goals'], 'id');
    $changed = false;
    foreach (default_database()['goals'] as $seedGoal) {
        $isDeleted = in_array($seedGoal['id'], $db['deletedCoreGoals'], true);
        if (!empty($seedGoal['locked'])
            && !$isDeleted
            && !in_array($seedGoal['id'], $existingIds, true)) {
            $db['goals'][] = $seedGoal;
            $changed = true;
        }
    }
    if ($changed) {
        store_write($username, $db);
    }

    return $db;
}

function store_write(string $username, array $db): void
{
    $path = store_path($username);
    file_put_contents($path, json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

// ---------- History / undo ----------

const MAX_HISTORY = 60;

/** The parts of a store worth snapshotting for undo / rollback. */
function snapshot_state(array $db): array
{
    return [
        'goals' => $db['goals'] ?? [],
        'outreachItems' => $db['outreachItems'] ?? [],
        'books' => $db['books'] ?? [],
        'deletedCoreGoals' => $db['deletedCoreGoals'] ?? [],
    ];
}

/**
 * Snapshot the CURRENT on-disk state before a mutation runs, so it can be
 * undone or rolled back to later. Call this *before* applying a change.
 */
function record_history(string $user, string $label): void
{
    $db = store_read($user);
    $history = $db['history'] ?? [];
    $history[] = [
        'ts' => time(),
        'label' => $label,
        'state' => snapshot_state($db),
    ];
    if (count($history) > MAX_HISTORY) {
        $history = array_slice($history, -MAX_HISTORY);
    }
    $db['history'] = $history;
    store_write($user, $db);
}

/** Restore a snapshot's data onto the live store (keeping history + meta). */
function apply_snapshot(array &$db, array $state): void
{
    $db['goals'] = $state['goals'] ?? [];
    $db['outreachItems'] = $state['outreachItems'] ?? [];
    $db['books'] = $state['books'] ?? [];
    $db['deletedCoreGoals'] = $state['deletedCoreGoals'] ?? [];
}

/** Undo the most recent change. Returns true if anything was undone. */
function undo_last(string $user): bool
{
    $db = store_read($user);
    $history = $db['history'] ?? [];
    if (count($history) === 0) {
        return false;
    }
    $entry = array_pop($history);
    apply_snapshot($db, $entry['state']);
    $db['history'] = $history;
    store_write($user, $db);
    return true;
}

/**
 * Roll back to a specific history entry (by index). The current state is first
 * recorded as a new history entry, so the rollback itself can be undone.
 */
function rollback_history(string $user, int $index): bool
{
    $db = store_read($user);
    $history = $db['history'] ?? [];
    if (!isset($history[$index])) {
        return false;
    }
    // Record where we are now so the restore is reversible.
    $history[] = [
        'ts' => time(),
        'label' => 'Before restoring an earlier version',
        'state' => snapshot_state($db),
    ];
    apply_snapshot($db, $history[$index]['state']);
    if (count($history) > MAX_HISTORY) {
        $history = array_slice($history, -MAX_HISTORY);
    }
    $db['history'] = $history;
    store_write($user, $db);
    return true;
}

function clear_history(string $user): void
{
    $db = store_read($user);
    $db['history'] = [];
    store_write($user, $db);
}

// ---------- Goal helpers ----------

function &find_goal(array &$db, string $goalId): ?array
{
    $null = null;
    foreach ($db['goals'] as $i => $_) {
        if ($db['goals'][$i]['id'] === $goalId) {
            return $db['goals'][$i];
        }
    }
    return $null;
}

// ---------- Goal mutations ----------

function set_daily_count(string $user, string $goalId, string $dateKey, int $count): void
{
    $db = store_read($user);
    $goal = &find_goal($db, $goalId);
    if ($goal !== null) {
        $max = (int) ($goal['perDay'] ?? 1);
        $clamped = max(0, min($max, $count));
        if ($clamped === 0) {
            unset($goal['dailyLog'][$dateKey]);
        } else {
            $goal['dailyLog'][$dateKey] = $clamped;
        }
    }
    store_write($user, $db);
}

function adjust_month_count(string $user, string $goalId, string $monthKey, int $delta): void
{
    $db = store_read($user);
    $goal = &find_goal($db, $goalId);
    if ($goal !== null) {
        $current = (int) ($goal['months'][$monthKey]['count'] ?? 0);
        $goal['months'][$monthKey]['count'] = max(0, $current + $delta);
    }
    store_write($user, $db);
}

function add_month_entry(string $user, string $goalId, string $monthKey, string $label): void
{
    $trimmed = trim($label);
    if ($trimmed === '') {
        return;
    }
    $db = store_read($user);
    $goal = &find_goal($db, $goalId);
    if ($goal !== null) {
        $entries = $goal['months'][$monthKey]['entries'] ?? [];
        $entries[] = $trimmed;
        $goal['months'][$monthKey]['entries'] = $entries;
        $goal['months'][$monthKey]['count'] = count($entries);
    }
    store_write($user, $db);
}

function remove_month_entry(string $user, string $goalId, string $monthKey, int $index): void
{
    $db = store_read($user);
    $goal = &find_goal($db, $goalId);
    if ($goal !== null) {
        $entries = $goal['months'][$monthKey]['entries'] ?? [];
        array_splice($entries, $index, 1);
        $goal['months'][$monthKey]['entries'] = array_values($entries);
        $goal['months'][$monthKey]['count'] = count($entries);
    }
    store_write($user, $db);
}

function toggle_project_step(string $user, string $goalId, string $monthKey, string $stepId): void
{
    $db = store_read($user);
    $goal = &find_goal($db, $goalId);
    if ($goal !== null) {
        $steps = $goal['months'][$monthKey]['steps'] ?? null;
        if (!is_array($steps)) {
            $steps = array_map(
                fn($title) => ['id' => step_id_for($title), 'title' => $title, 'completed' => false],
                $goal['stepTemplate'] ?? []
            );
        }
        foreach ($steps as $i => $s) {
            if ($s['id'] === $stepId) {
                $steps[$i]['completed'] = !$s['completed'];
            }
        }
        $goal['months'][$monthKey]['steps'] = $steps;
    }
    store_write($user, $db);
}

function create_goal(string $user, array $input): void
{
    $db = store_read($user);
    $type = $input['type'];
    $goal = [
        'id' => slugify($input['title']),
        'title' => trim($input['title']) ?: 'New goal',
        'category' => $input['category'],
        'type' => $type,
        'locked' => false,
        'dailyLog' => [],
        'months' => [],
        'notes' => '',
    ];
    if ($type === 'daily') {
        $goal['perDay'] = max(1, (int) ($input['perDay'] ?? 1));
    }
    if ($type === 'count') {
        $goal['monthlyTarget'] = max(1, (int) ($input['monthlyTarget'] ?? 1));
        $goal['unit'] = $input['unit'] ?? 'times';
        $goal['logEntries'] = !empty($input['logEntries']);
    }
    if ($type === 'project') {
        $goal['stepTemplate'] = $input['stepTemplate'] ?? ['Idea', 'Draft', 'Finish'];
    }
    $db['goals'][] = $goal;
    store_write($user, $db);
}

function delete_goal(string $user, string $goalId): void
{
    $db = store_read($user);

    // If this is a core/seed goal, remember it so store_read doesn't re-add it.
    $coreIds = array_column(default_database()['goals'], 'id');
    if (in_array($goalId, $coreIds, true)) {
        $db['deletedCoreGoals'] = array_values(array_unique(
            array_merge($db['deletedCoreGoals'] ?? [], [$goalId])
        ));
    }

    $db['goals'] = array_values(array_filter(
        $db['goals'],
        fn($g) => $g['id'] !== $goalId
    ));
    store_write($user, $db);
}

/** Flip a goal's "protected" flag (asks for extra confirmation before delete). */
function toggle_goal_protected(string $user, string $goalId): void
{
    $db = store_read($user);
    $goal = &find_goal($db, $goalId);
    if ($goal !== null) {
        $goal['locked'] = empty($goal['locked']);
    }
    store_write($user, $db);
}

// ---------- Goal option pools ----------
// A reusable backlog of candidate entries for a goal (e.g. all the house jobs
// for the year), that can be picked into any month or logged fresh.

function add_goal_option(string $user, string $goalId, string $label): void
{
    $trimmed = trim($label);
    if ($trimmed === '') {
        return;
    }
    $db = store_read($user);
    $goal = &find_goal($db, $goalId);
    if ($goal !== null) {
        $options = $goal['options'] ?? [];
        if (!in_array($trimmed, $options, true)) {
            $options[] = $trimmed;
        }
        $goal['options'] = array_values($options);
    }
    store_write($user, $db);
}

function remove_goal_option(string $user, string $goalId, int $index): void
{
    $db = store_read($user);
    $goal = &find_goal($db, $goalId);
    if ($goal !== null) {
        $options = $goal['options'] ?? [];
        array_splice($options, $index, 1);
        $goal['options'] = array_values($options);
    }
    store_write($user, $db);
}

// ---------- Settings ----------
// Per-user preferences (currently: which sections/tabs are visible).

function update_settings(string $user, array $patch): void
{
    $db = store_read($user);
    $settings = array_merge(default_settings(), is_array($db['settings'] ?? null) ? $db['settings'] : []);
    foreach (['showGoals', 'showFollowups', 'showBooks'] as $key) {
        if (array_key_exists($key, $patch)) {
            $settings[$key] = (bool) $patch[$key];
        }
    }
    // Never let the user hide every section — keep Goals on as a fallback.
    if (!$settings['showGoals'] && !$settings['showFollowups'] && !$settings['showBooks']) {
        $settings['showGoals'] = true;
    }
    $db['settings'] = $settings;
    store_write($user, $db);
}

// ---------- Outreach mutations ----------

function create_outreach(string $user, array $input): void
{
    $db = store_read($user);
    $today = today_key();
    $followUpInDays = (int) ($input['followUpInDays'] ?? 0);
    $item = [
        'id' => slugify($input['name']),
        'name' => trim($input['name']) ?: 'New contact',
        'topic' => trim($input['topic'] ?? '') ?: 'General follow-up',
        'channel' => $input['channel'] ?? 'email',
        'stage' => 'todo',
        'lastAction' => $today,
        'followUpOn' => $followUpInDays > 0 ? add_days_string($today, $followUpInDays) : null,
        'nextAction' => trim($input['nextAction'] ?? '') ?: 'Draft the first message.',
        'history' => [],
    ];
    array_unshift($db['outreachItems'], $item);
    store_write($user, $db);
}

function delete_outreach(string $user, string $itemId): void
{
    $db = store_read($user);
    $db['outreachItems'] = array_values(array_filter($db['outreachItems'], fn($i) => $i['id'] !== $itemId));
    store_write($user, $db);
}

function set_outreach_stage(string $user, string $itemId, string $stage): void
{
    $db = store_read($user);
    foreach ($db['outreachItems'] as $i => $item) {
        if ($item['id'] === $itemId) {
            $db['outreachItems'][$i]['stage'] = $stage;
        }
    }
    store_write($user, $db);
}

function log_outreach_touch(string $user, string $itemId, ?string $note = null, int $followUpInDays = 5): void
{
    $db = store_read($user);
    $today = today_key();
    foreach ($db['outreachItems'] as $i => $item) {
        if ($item['id'] === $itemId) {
            $db['outreachItems'][$i]['stage'] = 'waiting';
            $db['outreachItems'][$i]['lastAction'] = $today;
            $db['outreachItems'][$i]['followUpOn'] = $followUpInDays > 0 ? add_days_string($today, $followUpInDays) : null;
            array_unshift($db['outreachItems'][$i]['history'], ['date' => $today, 'note' => trim((string) $note) ?: 'Reached out']);
        }
    }
    store_write($user, $db);
}

function snooze_outreach(string $user, string $itemId, int $days): void
{
    $db = store_read($user);
    $today = today_key();
    foreach ($db['outreachItems'] as $i => $item) {
        if ($item['id'] === $itemId) {
            $base = $item['followUpOn'] ?? $today;
            $db['outreachItems'][$i]['followUpOn'] = add_days_string($base, $days);
        }
    }
    store_write($user, $db);
}

function update_outreach_fields(string $user, string $itemId, array $patch): void
{
    $db = store_read($user);
    $allowed = ['name', 'topic', 'channel', 'nextAction', 'followUpOn'];
    foreach ($db['outreachItems'] as $i => $item) {
        if ($item['id'] === $itemId) {
            foreach ($allowed as $key) {
                if (array_key_exists($key, $patch)) {
                    $db['outreachItems'][$i][$key] = $patch[$key];
                }
            }
        }
    }
    store_write($user, $db);
}

// ---------- Book log ----------

function &find_book(array &$db, string $bookId): ?array
{
    $null = null;
    foreach ($db['books'] as $i => $_) {
        if ($db['books'][$i]['id'] === $bookId) {
            return $db['books'][$i];
        }
    }
    return $null;
}

function create_book(string $user, array $input): void
{
    $title = trim($input['title'] ?? '');
    if ($title === '') {
        return;
    }
    $db = store_read($user);
    $completed = !empty($input['completed']);
    $book = [
        'id' => slugify($title),
        'title' => $title,
        'author' => trim($input['author'] ?? ''),
        'readingTime' => trim($input['readingTime'] ?? ''),
        'pages' => max(0, (int) ($input['pages'] ?? 0)),
        'finishedOn' => $completed ? (trim($input['finishedOn'] ?? '') ?: today_key()) : '',
        'bookClub' => !empty($input['bookClub']),
        'notes' => [],
    ];
    array_unshift($db['books'], $book);
    store_write($user, $db);
}

function update_book(string $user, string $bookId, array $patch): void
{
    $db = store_read($user);
    $book = &find_book($db, $bookId);
    if ($book !== null) {
        if (array_key_exists('title', $patch) && trim((string) $patch['title']) !== '') {
            $book['title'] = trim((string) $patch['title']);
        }
        if (array_key_exists('author', $patch)) {
            $book['author'] = trim((string) $patch['author']);
        }
        if (array_key_exists('readingTime', $patch)) {
            $book['readingTime'] = trim((string) $patch['readingTime']);
        }
        if (array_key_exists('pages', $patch)) {
            $book['pages'] = max(0, (int) $patch['pages']);
        }
        if (array_key_exists('finishedOn', $patch)) {
            $book['finishedOn'] = trim((string) $patch['finishedOn']);
        }
    }
    store_write($user, $db);
}

function delete_book(string $user, string $bookId): void
{
    $db = store_read($user);
    $db['books'] = array_values(array_filter($db['books'], fn($b) => $b['id'] !== $bookId));
    store_write($user, $db);
}

function toggle_book_club(string $user, string $bookId): void
{
    $db = store_read($user);
    $book = &find_book($db, $bookId);
    if ($book !== null) {
        $book['bookClub'] = empty($book['bookClub']);
    }
    store_write($user, $db);
}

/** Flip a book between "currently reading" and "completed" (archive). */
function toggle_book_completed(string $user, string $bookId): void
{
    $db = store_read($user);
    $book = &find_book($db, $bookId);
    if ($book !== null) {
        // finishedOn is the single source of truth: clearing it moves the book
        // back to "currently reading"; setting it archives the book as completed.
        $book['finishedOn'] = !empty($book['finishedOn']) ? '' : today_key();
    }
    store_write($user, $db);
}

function add_book_note(string $user, string $bookId, string $text, ?string $page): void
{
    $trimmed = trim($text);
    if ($trimmed === '') {
        return;
    }
    $db = store_read($user);
    $book = &find_book($db, $bookId);
    if ($book !== null) {
        $notes = $book['notes'] ?? [];
        $notes[] = [
            'text' => $trimmed,
            'page' => ($page !== null && trim($page) !== '') ? (int) $page : null,
        ];
        $book['notes'] = $notes;
    }
    store_write($user, $db);
}

function remove_book_note(string $user, string $bookId, int $index): void
{
    $db = store_read($user);
    $book = &find_book($db, $bookId);
    if ($book !== null) {
        $notes = $book['notes'] ?? [];
        array_splice($notes, $index, 1);
        $book['notes'] = array_values($notes);
    }
    store_write($user, $db);
}

// ---------- Backup / restore ----------

/**
 * Replace a user's store from an uploaded JSON backup.
 * Returns an error message on failure, or null on success.
 */
function import_database(string $user, string $json): ?string
{
    $parsed = json_decode($json, true);
    if (!is_array($parsed)) {
        return "That file isn't valid JSON.";
    }
    if (!isset($parsed['goals']) || !is_array($parsed['goals'])
        || !isset($parsed['outreachItems']) || !is_array($parsed['outreachItems'])) {
        return "That doesn't look like a planner backup (missing goals or outreachItems).";
    }

    $db = [
        'version' => $parsed['version'] ?? 2,
        'goals' => array_values($parsed['goals']),
        'outreachItems' => array_values($parsed['outreachItems']),
        'books' => isset($parsed['books']) && is_array($parsed['books']) ? array_values($parsed['books']) : [],
        'history' => isset($parsed['history']) && is_array($parsed['history']) ? $parsed['history'] : [],
        'deletedCoreGoals' => isset($parsed['deletedCoreGoals']) && is_array($parsed['deletedCoreGoals']) ? array_values($parsed['deletedCoreGoals']) : [],
        'settings' => array_merge(default_settings(), isset($parsed['settings']) && is_array($parsed['settings']) ? $parsed['settings'] : []),
    ];
    // Keep the demo account on its daily-reset schedule.
    if ($user === DEMO_USER) {
        $db['demoResetOn'] = today_key();
    }
    store_write($user, $db);
    return null;
}
