<?php
// Date, month, and goal-math helpers, plus category/channel metadata.

declare(strict_types=1);

// ---------- Date helpers ----------

function pad2(int $value): string
{
    return str_pad((string) $value, 2, '0', STR_PAD_LEFT);
}

function today_key(): string
{
    return date('Y-m-d');
}

function current_month_key(): string
{
    return date('Y-m');
}

/** Shift a "YYYY-MM" key by N months. */
function add_month(string $monthKey, int $delta): string
{
    [$year, $month] = array_map('intval', explode('-', $monthKey));
    $ts = mktime(0, 0, 0, $month + $delta, 1, $year);
    return date('Y-m', $ts);
}

function days_in_month(string $monthKey): int
{
    [$year, $month] = array_map('intval', explode('-', $monthKey));
    return (int) date('t', mktime(0, 0, 0, $month, 1, $year));
}

/** "YYYY-MM-DD" key for a given month + day-of-month. */
function day_key(string $monthKey, int $day): string
{
    return $monthKey . '-' . pad2($day);
}

function month_label(string $monthKey): string
{
    [$year, $month] = array_map('intval', explode('-', $monthKey));
    return date('F Y', mktime(0, 0, 0, $month, 1, $year));
}

function format_long_date_now(): string
{
    return date('l, F j');
}

function format_short_date(string $dateString): string
{
    $ts = strtotime($dateString);
    return $ts ? date('M j', $ts) : $dateString;
}

function days_since(string $dateString): int
{
    $target = strtotime(date('Y-m-d', (int) strtotime($dateString)));
    $today = strtotime(today_key());
    $diff = (int) floor(($today - $target) / 86400);
    return max(0, $diff);
}

/** Positive = days until the date; negative = days overdue. */
function days_until(string $dateString): int
{
    $target = strtotime(date('Y-m-d', (int) strtotime($dateString)));
    $today = strtotime(today_key());
    return (int) round(($target - $today) / 86400);
}

// ---------- Goal math ----------

function step_id_for(string $title): string
{
    $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower($title));
    return trim((string) $slug, '-');
}

function daily_done(array $goal, string $monthKey): int
{
    $sum = 0;
    foreach (($goal['dailyLog'] ?? []) as $k => $v) {
        if (str_starts_with((string) $k, $monthKey)) {
            $sum += (int) $v;
        }
    }
    return $sum;
}

function daily_target(array $goal, string $monthKey): int
{
    return days_in_month($monthKey) * (int) ($goal['perDay'] ?? 1);
}

function count_done(array $goal, string $monthKey): int
{
    $state = $goal['months'][$monthKey] ?? [];
    if (!empty($goal['logEntries'])) {
        return count($state['entries'] ?? []);
    }
    return (int) ($state['count'] ?? 0);
}

/** @return string[] */
function count_entries(array $goal, string $monthKey): array
{
    return $goal['months'][$monthKey]['entries'] ?? [];
}

/** @return array<int, array{id:string,title:string,completed:bool}> */
function project_steps(array $goal, string $monthKey): array
{
    $existing = $goal['months'][$monthKey]['steps'] ?? null;
    if (is_array($existing)) {
        return $existing;
    }
    return array_map(
        fn(string $title) => ['id' => step_id_for($title), 'title' => $title, 'completed' => false],
        $goal['stepTemplate'] ?? []
    );
}

/** Fraction (0..1) of the selected month that has elapsed. */
function month_elapsed_fraction(string $monthKey): float
{
    $cur = current_month_key();
    if ($monthKey < $cur) {
        return 1.0;
    }
    if ($monthKey > $cur) {
        return 0.0;
    }
    return (int) date('j') / days_in_month($monthKey);
}

function goal_percent(array $goal, string $monthKey): int
{
    if ($goal['type'] === 'daily') {
        $t = daily_target($goal, $monthKey);
        return $t === 0 ? 0 : (int) round((daily_done($goal, $monthKey) / $t) * 100);
    }
    if ($goal['type'] === 'count') {
        $t = (int) ($goal['monthlyTarget'] ?? 1);
        return $t === 0 ? 0 : min(100, (int) round((count_done($goal, $monthKey) / $t) * 100));
    }
    $steps = project_steps($goal, $monthKey);
    if (count($steps) === 0) {
        return 0;
    }
    $completed = count(array_filter($steps, fn($s) => !empty($s['completed'])));
    return (int) round(($completed / count($steps)) * 100);
}

function goal_on_pace(array $goal, string $monthKey): bool
{
    $elapsed = month_elapsed_fraction($monthKey);
    $cur = current_month_key();
    if ($goal['type'] === 'daily') {
        $elapsedDays = $monthKey < $cur ? days_in_month($monthKey) : ($monthKey > $cur ? 0 : (int) date('j'));
        $expected = (int) ($goal['perDay'] ?? 1) * $elapsedDays;
        return daily_done($goal, $monthKey) >= $expected;
    }
    if ($goal['type'] === 'count') {
        $target = (int) ($goal['monthlyTarget'] ?? 1);
        $done = count_done($goal, $monthKey);
    } else {
        $steps = project_steps($goal, $monthKey);
        $target = count($steps);
        $done = count(array_filter($steps, fn($s) => !empty($s['completed'])));
    }
    return $done >= (int) ceil($target * $elapsed);
}

// ---------- Category + channel metadata ----------

const CATEGORY_META = [
    'prayer'   => ['label' => 'Prayer',        'icon' => '☾',  'gradient' => 'from-emerald-500 to-teal-500',  'soft' => 'bg-emerald-500/10 border-emerald-400/20 text-emerald-200'],
    'exercise' => ['label' => 'Exercise',      'icon' => '⚡', 'gradient' => 'from-sky-500 to-indigo-500',    'soft' => 'bg-sky-500/10 border-sky-400/20 text-sky-200'],
    'stretch'  => ['label' => 'Stretch',       'icon' => '🧘', 'gradient' => 'from-violet-500 to-purple-500', 'soft' => 'bg-violet-500/10 border-violet-400/20 text-violet-200'],
    'reading'  => ['label' => 'Reading',       'icon' => '📖', 'gradient' => 'from-amber-500 to-orange-500',  'soft' => 'bg-amber-500/10 border-amber-400/20 text-amber-200'],
    'video'    => ['label' => 'YouTube',       'icon' => '▶',  'gradient' => 'from-rose-500 to-pink-500',     'soft' => 'bg-rose-500/10 border-rose-400/20 text-rose-200'],
    'blog'     => ['label' => 'Blog',          'icon' => '✍',  'gradient' => 'from-blue-500 to-cyan-500',     'soft' => 'bg-blue-500/10 border-blue-400/20 text-blue-200'],
    'craft'    => ['label' => 'Arts & Crafts', 'icon' => '🎨', 'gradient' => 'from-pink-500 to-rose-500',     'soft' => 'bg-pink-500/10 border-pink-400/20 text-pink-200'],
    'finance'  => ['label' => 'Finance',       'icon' => '💰', 'gradient' => 'from-green-500 to-emerald-500', 'soft' => 'bg-green-500/10 border-green-400/20 text-green-200'],
    'rest'     => ['label' => 'Rest Day',      'icon' => '🌴', 'gradient' => 'from-teal-500 to-cyan-500',     'soft' => 'bg-teal-500/10 border-teal-400/20 text-teal-200'],
    'soccer'   => ['label' => 'Soccer',        'icon' => '⚽', 'gradient' => 'from-lime-500 to-green-500',    'soft' => 'bg-lime-500/10 border-lime-400/20 text-lime-200'],
    'other'    => ['label' => 'Goal',          'icon' => '◆',  'gradient' => 'from-slate-500 to-slate-400',   'soft' => 'bg-slate-500/10 border-slate-400/20 text-slate-300'],
];

const CHANNEL_META = [
    'email' => ['label' => 'Email', 'icon' => '✉'],
    'text'  => ['label' => 'Text',  'icon' => '💬'],
    'call'  => ['label' => 'Call',  'icon' => '☎'],
    'dm'    => ['label' => 'DM',    'icon' => '@'],
    'meet'  => ['label' => 'Meet',  'icon' => '🤝'],
];

const CATEGORIES = ['prayer', 'exercise', 'stretch', 'reading', 'video', 'blog', 'craft', 'finance', 'rest', 'soccer', 'other'];

function category_meta(string $category): array
{
    return CATEGORY_META[$category] ?? CATEGORY_META['other'];
}

function channel_meta(string $channel): array
{
    return CHANNEL_META[$channel] ?? CHANNEL_META['email'];
}

// ---------- Small utilities ----------

function app_base_path(): string
{
    $scriptName = (string) ($_SERVER['SCRIPT_NAME'] ?? $_SERVER['PHP_SELF'] ?? '');
    $base = str_replace('\\', '/', dirname($scriptName));
    if ($base === '/' || $base === '.' || $base === '\\') {
        return '';
    }
    return rtrim($base, '/');
}

function app_url(string $path = '/'): string
{
    $base = app_base_path();

    if ($path === '' || $path === '/') {
        return $base !== '' ? $base . '/' : '/';
    }

    if (!str_starts_with($path, '/')) {
        $path = '/' . $path;
    }

    return ($base !== '' ? $base : '') . $path;
}

function is_htmx_request(): bool
{
    return strtolower((string) ($_SERVER['HTTP_HX_REQUEST'] ?? '')) === 'true';
}

/** HTML-escape shorthand. */
function e(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

/** Join truthy class strings (mirrors the cn() helper). */
function cn(string ...$classes): string
{
    return implode(' ', array_filter($classes, fn($c) => $c !== '' && $c !== null));
}

function slugify(string $value): string
{
    $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower(trim($value)));
    $slug = trim((string) $slug, '-');
    if ($slug === '') {
        $slug = 'item';
    }
    return $slug . '-' . substr(bin2hex(random_bytes(4)), 0, 5);
}

function add_days_string(string $base, int $days): string
{
    $ts = strtotime($base . ' +' . $days . ' days');
    return date('Y-m-d', $ts ?: time());
}
