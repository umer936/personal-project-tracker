<?php
// Front controller for the Rhythm planner. FrankenPHP (Caddy) rewrites every
// non-file request here; we route by method + path.

declare(strict_types=1);

require_once __DIR__ . '/../src/auth.php';
require_once __DIR__ . '/../src/views/layout.php';
require_once __DIR__ . '/../src/views/auth.php';
require_once __DIR__ . '/../src/views/app.php';
require_once __DIR__ . '/../src/views/admin.php';

ensure_demo_user();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = current_request_path();

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

function post(string $key, string $default = ''): string
{
    return isset($_POST[$key]) ? (string) $_POST[$key] : $default;
}

/** Sanitize the tab/month context echoed back into redirects. */
function safe_tab(string $tab): string
{
    return $tab === 'outreach' ? 'outreach' : 'goals';
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
