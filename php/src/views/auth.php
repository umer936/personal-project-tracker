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
    <div class="pointer-events-none fixed inset-0 overflow-hidden">
        <div class="animate-float-slow absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl"></div>
        <div class="animate-float-slow absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" style="animation-delay:2s"></div>
    </div>

    <main class="relative flex min-h-screen items-center justify-center p-4">
        <div class="animate-fade-in w-full max-w-sm">
            <div class="mb-6 flex items-center justify-center gap-2.5">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500 to-fuchsia-500 text-base font-bold text-white shadow-lg shadow-fuchsia-500/30">R</div>
                <div class="leading-tight">
                    <p class="text-base font-semibold text-white">Rhythm</p>
                    <p class="text-[11px] text-slate-500">Personal planner</p>
                </div>
            </div>

            <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
                <h1 class="mb-1 text-lg font-semibold text-white"><?= $isRegister ? 'Create an account' : 'Welcome back' ?></h1>
                <p class="mb-4 text-sm text-slate-400"><?= $isRegister ? 'Your planner is private to your account.' : 'Sign in to see your planner.' ?></p>

                <?php if ($error): ?>
                    <p class="mb-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"><?= e($error) ?></p>
                <?php endif; ?>

                <form method="post" action="<?= e(app_url($isRegister ? '/register' : '/login')) ?>" class="space-y-3">
                    <input type="hidden" name="csrf" value="<?= e($token) ?>">
                    <div>
                        <label class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Username</label>
                        <input name="username" value="<?= e($username) ?>" autofocus autocomplete="username"
                               class="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
                               placeholder="e.g. umer">
                    </div>
                    <div>
                        <label class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Password</label>
                        <input name="password" type="password" autocomplete="<?= $isRegister ? 'new-password' : 'current-password' ?>"
                               class="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
                               placeholder="••••••••">
                    </div>
                    <?php if ($isRegister): ?>
                        <div>
                            <label class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Confirm password</label>
                            <input name="confirm" type="password" autocomplete="new-password"
                                   class="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50"
                                   placeholder="••••••••">
                        </div>
                    <?php endif; ?>

                    <button type="submit" class="w-full rounded-lg bg-linear-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">
                        <?= $isRegister ? 'Create account' : 'Sign in' ?>
                    </button>
                </form>

                <div class="mt-4 text-center text-sm text-slate-400">
                    <?php if ($isRegister): ?>
                        Already have an account? <a href="<?= e(app_url('/login')) ?>" class="text-cyan-300 hover:text-cyan-200">Sign in</a>
                    <?php else: ?>
                        New here? <a href="<?= e(app_url('/register')) ?>" class="text-cyan-300 hover:text-cyan-200">Create an account</a>
                    <?php endif; ?>
                </div>
            </div>

            <form method="post" action="<?= e(app_url('/login')) ?>" class="mt-4">
                <input type="hidden" name="csrf" value="<?= e($token) ?>">
                <input type="hidden" name="username" value="demo">
                <input type="hidden" name="password" value="<?= e(DEMO_PASSWORD) ?>">
                <button type="submit" class="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white">
                    👀 Try the demo <span class="text-slate-500">— resets daily</span>
                </button>
            </form>
        </div>
    </main>
    <?php
    layout_foot();
}
