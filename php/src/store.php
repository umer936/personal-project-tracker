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

    // Demo account: lazily reset to defaults once per day.
    if ($username === DEMO_USER && ($db['demoResetOn'] ?? null) !== today_key()) {
        $db = demo_database();
        $db['demoResetOn'] = today_key();
        store_write($username, $db);
        return $db;
    }

    // Merge in any new locked core goals shipped in the seed.
    $existingIds = array_column($db['goals'], 'id');
    $changed = false;
    foreach (default_database()['goals'] as $seedGoal) {
        if (!empty($seedGoal['locked']) && !in_array($seedGoal['id'], $existingIds, true)) {
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
    $db['goals'] = array_values(array_filter(
        $db['goals'],
        fn($g) => $g['id'] !== $goalId || !empty($g['locked'])
    ));
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
    ];
    // Keep the demo account on its daily-reset schedule.
    if ($user === DEMO_USER) {
        $db['demoResetOn'] = today_key();
    }
    store_write($user, $db);
    return null;
}
