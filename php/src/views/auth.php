<?php
// Login + registration screen. Both forms live on one page; the ?mode=register
// query switches which one is shown.

declare(strict_types=1);

/**
 * @param 'login'|'register' $mode
 */
function render_auth_page(string $mode, ?string $error, string $username = ''): void
{
    $isRegister = $mode === 'register';
    $token = csrf_token();

    layout_head($isRegister ? 'Register · Rhythm' : 'Sign in · Rhythm');
    ?>
    <div id="page-shell">
    <div class="pointer-events-none fixed inset-0 overflow-hidden">
        <div class="animate-float-slow absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl"></div>
        <div class="animate-float-slow absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" style="animation-delay:2s"></div>
    </div>

    <main class="relative flex min-h-screen items-center justify-center p-4">
        <div class="animate-fade-in w-full max-w-md">
            <div class="mb-6 flex items-center justify-center gap-2.5">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500 to-fuchsia-500 text-base font-bold text-white shadow-lg shadow-fuchsia-500/30">R</div>
                <div class="leading-tight">
                    <p class="text-base font-semibold text-white">Rhythm</p>
                    <p class="text-[11px] text-slate-500">Personal planner</p>
                </div>
            </div>

            <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
                <h1 class="mb-1 text-lg font-semibold text-white">Choose how to continue</h1>
                <p class="mb-4 text-sm text-slate-400"><?= $isRegister ? 'Create an account, sign in, or open the demo.' : 'Sign in, make an account, or open the demo.' ?></p>

                <?php if ($error): ?>
                    <p class="mb-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"><?= e($error) ?></p>
                <?php endif; ?>

                <form method="post" action="<?= e(app_url($isRegister ? '/register' : '/login')) ?>" data-hx-post="<?= e(app_url($isRegister ? '/register' : '/login')) ?>" data-hx-target="#page-shell" data-hx-select="#page-shell" data-hx-swap="outerHTML show:window:top" class="space-y-3">
                    <input type="hidden" name="csrf" value="<?= e($token) ?>">
                    <div>
                        <label for="username" class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Username</label>
                        <input id="username" name="username" value="<?= e($username) ?>" autofocus autocomplete="username"
                               class="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
                               placeholder="e.g. umer">
                    </div>
                    <div>
                        <label for="password" class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Password</label>
                        <input id="password" name="password" type="password" autocomplete="<?= $isRegister ? 'new-password' : 'current-password' ?>"
                               class="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
                               placeholder="••••••••">
                    </div>
                    <?php if ($isRegister): ?>
                        <div>
                            <label for="confirm" class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Confirm password</label>
                            <input id="confirm" name="confirm" type="password" autocomplete="new-password"
                                   class="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
                                   placeholder="••••••••">
                        </div>
                    <?php endif; ?>

                    <button type="submit" class="w-full rounded-lg bg-linear-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">
                        <?= $isRegister ? 'Create account' : 'Sign in' ?>
                    </button>
                </form>

                <div class="mt-6 border-t border-white/10 pt-4">
                    <p class="mb-3 text-center text-xs uppercase tracking-widest text-slate-500">
                        OR
                    </p>

                    <div class="grid gap-3 sm:grid-cols-2">
                        <?php if ($isRegister): ?>
                            <a href="<?= e(app_url('/login')) ?>" class="block w-full rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-left transition hover:bg-cyan-500/20 hover:text-cyan-100">
                                <span class="mb-1 block text-sm font-semibold text-cyan-100">🔐 Sign in instead</span>
                                <span class="block text-sm text-slate-300">Use an account you already made.</span>
                            </a>
                        <?php else: ?>
                            <a href="<?= e(app_url('/register')) ?>" class="block w-full rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-left transition hover:bg-emerald-500/20 hover:text-emerald-100">
                                <span class="mb-1 block text-sm font-semibold text-emerald-100">✨ Create an account</span>
                                <span class="block text-sm text-slate-300">Save your own planner and history.</span>
                            </a>
                        <?php endif; ?>

                        <form method="post" action="<?= e(app_url('/login')) ?>" data-hx-post="<?= e(app_url('/login')) ?>" data-hx-target="#page-shell" data-hx-select="#page-shell" data-hx-swap="outerHTML show:window:top">
                            <input type="hidden" name="csrf" value="<?= e($token) ?>">
                            <input type="hidden" name="username" value="demo">
                            <input type="hidden" name="password" value="<?= e(DEMO_PASSWORD) ?>">
                            <button type="submit" class="block w-full rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-left transition hover:bg-amber-500/15 hover:text-amber-100">
                                <span class="mb-1 block text-sm font-semibold text-amber-100">👀 Try the demo</span>
                                <span class="block text-sm text-slate-300">Open the app right away with no signup.</span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </main>
    </div>
    <?php
    layout_foot();
}
