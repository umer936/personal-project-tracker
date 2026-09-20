<?php
// Session-based auth with open registration. User credentials live in
// data/users.json (username -> password hash). The demo account is
// auto-provisioned so anyone can look around without signing up.

declare(strict_types=1);

require_once __DIR__ . '/store.php';

const DEMO_PASSWORD = 'demo';

// The single admin account. Whoever holds this username can manage other users.
const ADMIN_USER = 'umer936';

function is_admin(?string $user): bool
{
    return $user !== null && $user === ADMIN_USER;
}

function users_path(): string
{
    return data_dir() . '/users.json';
}

function load_users(): array
{
    $path = users_path();
    if (!is_file($path)) {
        return [];
    }
    $data = json_decode((string) file_get_contents($path), true);
    return is_array($data) ? $data : [];
}

function save_users(array $users): void
{
    file_put_contents(users_path(), json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
}

function ensure_demo_user(): void
{
    $users = load_users();
    if (!isset($users[DEMO_USER])) {
        $users[DEMO_USER] = [
            'hash' => password_hash(DEMO_PASSWORD, PASSWORD_DEFAULT),
            'created' => today_key(),
            'demo' => true,
        ];
        save_users($users);
    }
}

function start_session(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_name('rhythm_session');
        session_set_cookie_params([
            'httponly' => true,
            'samesite' => 'Lax',
            'path' => '/',
        ]);
        session_start();
    }
}

function current_user(): ?string
{
    start_session();
    return $_SESSION['user'] ?? null;
}

function require_login(): string
{
    $user = current_user();
    if ($user === null) {
        header('Location: /login');
        exit;
    }
    return $user;
}

function require_admin(): string
{
    $user = require_login();
    if (!is_admin($user)) {
        header('Location: /');
        exit;
    }
    return $user;
}

/** @return array{0:bool,1:?string} [success, errorMessage] */
function attempt_login(string $username, string $password): array
{
    $username = strtolower(trim($username));
    $users = load_users();
    if (!isset($users[$username]) || !password_verify($password, $users[$username]['hash'])) {
        return [false, 'Wrong username or password.'];
    }
    start_session();
    session_regenerate_id(true);
    $_SESSION['user'] = $username;
    return [true, null];
}

/** @return array{0:bool,1:?string} [success, errorMessage] */
function attempt_register(string $username, string $password, string $confirm): array
{
    $username = strtolower(trim($username));

    if (!preg_match('/^[a-z0-9_-]{3,20}$/', $username)) {
        return [false, 'Username must be 3–20 characters: letters, numbers, dashes or underscores.'];
    }
    if ($username === DEMO_USER) {
        return [false, 'That username is reserved.'];
    }
    if (strlen($password) < 6) {
        return [false, 'Password must be at least 6 characters.'];
    }
    if ($password !== $confirm) {
        return [false, "Passwords don't match."];
    }

    $users = load_users();
    if (isset($users[$username])) {
        return [false, 'That username is already taken.'];
    }

    $users[$username] = [
        'hash' => password_hash($password, PASSWORD_DEFAULT),
        'created' => today_key(),
    ];
    save_users($users);

    // Seed their store immediately.
    store_read($username);

    start_session();
    session_regenerate_id(true);
    $_SESSION['user'] = $username;
    return [true, null];
}

function logout(): void
{
    start_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

// ---------- CSRF ----------

function csrf_token(): string
{
    start_session();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf'];
}

function verify_csrf(?string $token): bool
{
    start_session();
    return is_string($token) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $token);
}

// ---------- Flash messages ----------

function set_flash(string $text, string $kind = 'ok'): void
{
    start_session();
    $_SESSION['flash'] = ['text' => $text, 'kind' => $kind];
}

/** @return array{text:string,kind:string}|null */
function take_flash(): ?array
{
    start_session();
    $flash = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return $flash;
}

// ---------- Admin: user management ----------

/**
 * A summary of every account for the admin page.
 * @return array<int, array{username:string,created:string,role:string,goals:int,followUps:int}>
 */
function list_user_summaries(): array
{
    $users = load_users();
    $rows = [];
    foreach ($users as $username => $meta) {
        $db = store_read($username);
        $role = $username === ADMIN_USER ? 'admin' : (!empty($meta['demo']) ? 'demo' : 'user');
        $rows[] = [
            'username' => $username,
            'created' => $meta['created'] ?? '—',
            'role' => $role,
            'goals' => count($db['goals'] ?? []),
            'followUps' => count($db['outreachItems'] ?? []),
        ];
    }
    usort($rows, fn($a, $b) => strcmp($a['username'], $b['username']));
    return $rows;
}

/** Delete an account and its stored planner. The admin account is protected. */
function delete_user(string $username): bool
{
    $username = strtolower(trim($username));
    if ($username === ADMIN_USER || $username === '') {
        return false;
    }
    $users = load_users();
    if (!isset($users[$username])) {
        return false;
    }
    unset($users[$username]);
    save_users($users);
    @unlink(store_path($username));
    return true;
}
