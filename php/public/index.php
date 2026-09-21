<?php
// Front controller for the Rhythm planner. FrankenPHP (Caddy) rewrites every
// non-file request here; we route by method + path.

declare(strict_types=1);

require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/views/layout.php';
require_once __DIR__ . '/../src/views/auth.php';
require_once __DIR__ . '/../src/views/app.php';
require_once __DIR__ . '/../src/views/admin.php';
require_once __DIR__ . '/../src/views/history.php';

ensure_demo_user();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = current_request_path();

// ---------- PWA: manifest, service worker & icon (public, no login needed) ----------

if ($path === '/manifest.webmanifest') {
    header('Content-Type: application/manifest+json');
    header('Cache-Control: max-age=3600');
    echo json_encode([
        'name' => 'Rhythm · Personal Planner',
        'short_name' => 'Rhythm',
        'description' => 'A calm, focused personal planner: rhythms, monthly progress, outreach and a book log.',
        'start_url' => app_url('/'),
        'scope' => app_url('/'),
        'display' => 'standalone',
        'background_color' => '#020617',
        'theme_color' => '#020617',
        'icons' => [
            ['src' => app_url('/icon.svg'), 'sizes' => 'any', 'type' => 'image/svg+xml', 'purpose' => 'any maskable'],
        ],
    ], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

if ($path === '/icon.svg') {
    header('Content-Type: image/svg+xml');
    header('Cache-Control: max-age=604800');
    echo '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
        . '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
        . '<stop offset="0" stop-color="#06b6d4"/><stop offset="1" stop-color="#d946ef"/>'
        . '</linearGradient></defs>'
        . '<rect width="512" height="512" rx="96" fill="#020617"/>'
        . '<rect x="56" y="56" width="400" height="400" rx="72" fill="url(#g)"/>'
        . '<text x="256" y="330" font-family="system-ui,Segoe UI,Arial,sans-serif" font-size="260" '
        . 'font-weight="700" fill="#ffffff" text-anchor="middle">R</text></svg>';
    exit;
}

if ($path === '/sw.js') {
    header('Content-Type: application/javascript');
    header('Cache-Control: no-cache');
    $scope = app_url('/');
    $css = app_url('/app.css');
    echo <<<JS
// Rhythm service worker — offline-friendly app shell caching.
const CACHE = 'rhythm-v1';
const ASSETS = ['{$scope}', '{$css}', '{$scope}icon.svg'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    // Only handle GETs; never cache POST actions or auth flows.
    if (req.method !== 'GET') return;
    event.respondWith(
        fetch(req)
            .then((res) => {
                if (res.ok && req.url.startsWith(self.location.origin)) {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
                }
                return res;
            })
            .catch(() => caches.match(req).then((hit) => hit || caches.match('{$scope}')))
    );
});
JS;
    exit;
}


function current_request_path(): string
{
    $path = rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/', '/');
    if ($path === '') {
        $path = '/';
    }

    $base = app_base_path();
    if ($base !== '' && ($path === $base || str_starts_with($path, $base . '/'))) {
        $path = substr($path, strlen($base)) ?: '/';
    }

    if ($path === '/index.php') {
        return '/';
    }
    if (str_starts_with($path, '/index.php/')) {
        $path = substr($path, strlen('/index.php')) ?: '/';
    }

    return $path === '' ? '/' : $path;
}

function redirect(string $to): never
{
    $location = preg_match('~^[a-z][a-z0-9+.-]*://~i', $to) ? $to : app_url($to);
    header('Location: ' . $location);
    exit;
}

function planner_url(string $tab, string $month): string
{
    return '/?tab=' . $tab . '&month=' . $month;
}

function render_planner_response(string $user, string $tab, string $month): never
{
    header('HX-Replace-Url: ' . app_url(planner_url($tab, $month)));

    $db = store_read($user);
    render_app_page($user, $db, $tab, $month, take_flash());
    exit;
}

function render_admin_response(string $user): never
{
    header('HX-Replace-Url: ' . app_url('/admin'));

    render_admin_page($user, take_flash());
    exit;
}

function render_history_response(string $user): never
{
    header('HX-Replace-Url: ' . app_url('/history'));

    $db = store_read($user);
    render_history_page($user, $db, take_flash());
    exit;
}

function post(string $key, string $default = ''): string
{
    return isset($_POST[$key]) ? (string) $_POST[$key] : $default;
}

/** Sanitize the tab/month context echoed back into redirects. */
function safe_tab(string $tab): string
{
    return in_array($tab, ['outreach', 'books'], true) ? $tab : 'goals';
}
function safe_month(string $month): string
{
    return preg_match('/^\d{4}-\d{2}$/', $month) ? $month : current_month_key();
}

// ---------- Auth routes ----------

if ($path === '/login') {
    if ($method === 'POST') {
        if (!verify_csrf(post('csrf'))) {
            render_auth_page('login', 'Your session expired. Please try again.', post('username'));
            exit;
        }
        [$ok, $err] = attempt_login(post('username'), post('password'));
        if ($ok) {
            if (is_htmx_request()) {
                render_planner_response(require_login(), 'goals', current_month_key());
            }
            redirect('/');
        }
        render_auth_page('login', $err, post('username'));
        exit;
    }
    if (current_user() !== null) {
        if (is_htmx_request()) {
            render_planner_response(require_login(), 'goals', current_month_key());
        }
        redirect('/');
    }
    render_auth_page('login', null);
    exit;
}

if ($path === '/register') {
    if ($method === 'POST') {
        if (!verify_csrf(post('csrf'))) {
            render_auth_page('register', 'Your session expired. Please try again.', post('username'));
            exit;
        }
        [$ok, $err] = attempt_register(post('username'), post('password'), post('confirm'));
        if ($ok) {
            if (is_htmx_request()) {
                render_planner_response(require_login(), 'goals', current_month_key());
            }
            redirect('/');
        }
        render_auth_page('register', $err, post('username'));
        exit;
    }
    if (current_user() !== null) {
        if (is_htmx_request()) {
            render_planner_response(require_login(), 'goals', current_month_key());
        }
        redirect('/');
    }
    render_auth_page('register', null);
    exit;
}

if ($path === '/logout') {
    if ($method === 'POST' && verify_csrf(post('csrf'))) {
        logout();
    }
    if (is_htmx_request()) {
        header('HX-Replace-Url: ' . app_url('/login'));
        render_auth_page('login', null);
        exit;
    }
    redirect('/login');
}

// ---------- Everything below requires a logged-in user ----------

$user = require_login();

if ($path === '/export') {
    $db = store_read($user);
    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="rhythm-planner-backup-' . date('Y-m-d') . '.json"');
    echo json_encode($db, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($path === '/import' && $method === 'POST') {
    if (!verify_csrf(post('csrf'))) {
        set_flash('Your session expired. Please try again.', 'error');
        render_planner_response($user, 'goals', current_month_key());
    }
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        set_flash('No file was uploaded.', 'error');
        render_planner_response($user, 'goals', current_month_key());
    }
    $json = (string) file_get_contents($_FILES['file']['tmp_name']);
    $error = import_database($user, $json);
    set_flash($error ?? 'Backup imported. You\'re all set.', $error ? 'error' : 'ok');
    render_planner_response($user, 'goals', current_month_key());
}

// ---------- History page ----------

if ($path === '/history') {
    render_history_response($user);
}

if ($path === '/history/action' && $method === 'POST') {
    if (verify_csrf(post('csrf'))) {
        switch (post('action')) {
            case 'rollback':
                if (rollback_history($user, (int) post('index'))) {
                    set_flash('Restored an earlier version. (You can undo this too.)', 'ok');
                } else {
                    set_flash('That version is no longer available.', 'error');
                }
                break;
            case 'undo':
                if (undo_last($user)) {
                    set_flash('Undid the last change.', 'ok');
                } else {
                    set_flash('Nothing to undo.', 'error');
                }
                break;
            case 'clearHistory':
                clear_history($user);
                set_flash('Cleared the change history.', 'ok');
                break;
        }
    }
    render_history_response($user);
}

// ---------- Admin routes ----------

if ($path === '/admin') {
    if (!is_admin($user)) {
        redirect('/');
    }
    render_admin_response($user);
}

if ($path === '/admin/action' && $method === 'POST') {
    if (!is_admin($user)) {
        redirect('/');
    }
    if (verify_csrf(post('csrf')) && post('action') === 'deleteUser') {
        $target = post('username');
        if (delete_user($target)) {
            set_flash('Deleted account “' . $target . '”.', 'ok');
        }
    }
    render_admin_response($user);
}

if ($path === '/action' && $method === 'POST') {
    $tab = safe_tab(post('tab'));
    $month = safe_month(post('month'));

    if (!verify_csrf(post('csrf'))) {
        set_flash('Your session expired. Please try again.', 'error');
        render_planner_response($user, $tab, $month);
    }

    $action = post('action');

    // Snapshot the current state before any data-changing action so the user can
    // undo it or roll back to it later from the History page.
    $historyLabels = [
        'setDay' => 'Updated a daily log',
        'count' => 'Changed a monthly count',
        'addEntry' => 'Logged an entry',
        'removeEntry' => 'Removed an entry',
        'step' => 'Toggled a project step',
        'createGoal' => 'Created a goal',
        'deleteGoal' => 'Deleted a goal',
        'toggleProtect' => 'Changed goal protection',
        'addOption' => 'Added a goal option',
        'removeOption' => 'Removed a goal option',
        'createOutreach' => 'Added a contact',
        'deleteOutreach' => 'Deleted a contact',
        'setStage' => 'Moved a contact',
        'touch' => 'Logged a touch',
        'snooze' => 'Snoozed a follow-up',
        'updateOutreach' => 'Edited a contact',
        'createBook' => 'Added a book',
        'deleteBook' => 'Deleted a book',
        'updateBook' => 'Edited a book',
        'toggleBookClub' => 'Toggled a book-club pick',
        'toggleBookCompleted' => 'Moved a book',
        'addBookNote' => 'Added a book note',
        'removeBookNote' => 'Removed a book note',
    ];
    if (isset($historyLabels[$action])) {
        record_history($user, $historyLabels[$action]);
    }

    switch ($action) {
        // Goals
        case 'setDay':
            set_daily_count($user, post('goalId'), post('date'), (int) post('count'));
            break;
        case 'count':
            adjust_month_count($user, post('goalId'), $month, (int) post('delta'));
            break;
        case 'addEntry':
            add_month_entry($user, post('goalId'), $month, post('label'));
            break;
        case 'removeEntry':
            remove_month_entry($user, post('goalId'), $month, (int) post('index'));
            break;
        case 'step':
            toggle_project_step($user, post('goalId'), $month, post('stepId'));
            break;
        case 'createGoal':
            create_goal($user, [
                'title' => post('title'),
                'category' => post('category', 'other'),
                'type' => post('type', 'count'),
                'perDay' => (int) post('perDay', '1'),
                'monthlyTarget' => (int) post('monthlyTarget', '1'),
                'unit' => post('unit', 'times'),
                'logEntries' => post('logEntries') !== '',
            ]);
            break;
        case 'deleteGoal':
            delete_goal($user, post('goalId'));
            break;
        case 'toggleProtect':
            toggle_goal_protected($user, post('goalId'));
            break;
        case 'addOption':
            add_goal_option($user, post('goalId'), post('label'));
            break;
        case 'removeOption':
            remove_goal_option($user, post('goalId'), (int) post('index'));
            break;

        // Settings (a preference change; not part of undo history)
        case 'updateSettings':
            update_settings($user, [
                'showGoals' => post('showGoals') !== '',
                'showFollowups' => post('showFollowups') !== '',
                'showBooks' => post('showBooks') !== '',
            ]);
            set_flash('Settings saved.', 'ok');
            break;

        // Undo (not itself recorded in history)
        case 'undo':
            if (undo_last($user)) {
                set_flash('Undid the last change.', 'ok');
            } else {
                set_flash('Nothing to undo.', 'error');
            }
            break;

        // Outreach
        case 'createOutreach':
            create_outreach($user, [
                'name' => post('name'),
                'topic' => post('topic'),
                'nextAction' => post('nextAction'),
                'channel' => post('channel', 'email'),
                'followUpInDays' => (int) post('followUpInDays', '0'),
            ]);
            break;
        case 'deleteOutreach':
            delete_outreach($user, post('id'));
            break;
        case 'setStage':
            set_outreach_stage($user, post('id'), post('stage'));
            break;
        case 'touch':
            log_outreach_touch($user, post('id'));
            break;
        case 'snooze':
            snooze_outreach($user, post('id'), (int) post('days', '3'));
            break;
        case 'updateOutreach':
            update_outreach_fields($user, post('id'), [
                'name' => post('name'),
                'topic' => post('topic'),
                'channel' => post('channel'),
                'nextAction' => post('nextAction'),
                'followUpOn' => post('followUpOn') !== '' ? post('followUpOn') : null,
            ]);
            break;

        // Books
        case 'createBook':
            create_book($user, [
                'title' => post('title'),
                'author' => post('author'),
                'readingTime' => post('readingTime'),
                'pages' => (int) post('pages', '0'),
                'finishedOn' => post('finishedOn'),
                'completed' => post('completed') !== '',
                'bookClub' => post('bookClub') !== '',
            ]);
            break;
        case 'updateBook':
            update_book($user, post('id'), [
                'title' => post('title'),
                'author' => post('author'),
                'readingTime' => post('readingTime'),
                'pages' => (int) post('pages', '0'),
                'finishedOn' => post('finishedOn'),
            ]);
            break;
        case 'deleteBook':
            delete_book($user, post('id'));
            break;
        case 'toggleBookClub':
            toggle_book_club($user, post('id'));
            break;
        case 'toggleBookCompleted':
            toggle_book_completed($user, post('id'));
            break;
        case 'addBookNote':
            add_book_note($user, post('id'), post('text'), post('page') !== '' ? post('page') : null);
            break;
        case 'removeBookNote':
            remove_book_note($user, post('id'), (int) post('index'));
            break;

        // Data
        case 'reset':
            @unlink(store_path($user));
            store_read($user); // re-seed
            set_flash('Reset to starter data.', 'ok');
            break;
    }

    render_planner_response($user, $tab, $month);
}

// ---------- Default: render the planner ----------

$tab = safe_tab($_GET['tab'] ?? 'goals');
$month = safe_month($_GET['month'] ?? current_month_key());
$db = store_read($user);
render_app_page($user, $db, $tab, $month, take_flash());
