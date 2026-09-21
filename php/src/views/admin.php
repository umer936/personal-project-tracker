<?php
// Admin-only screen for the site owner (umer936): list and manage accounts.

declare(strict_types=1);

function render_admin_page(string $user, ?array $flash = null): void
{
    $rows = list_user_summaries();
    $totalUsers = count($rows);

    layout_head('Admin · Rhythm');
    ?>
    <div id="page-shell">
    <main class="relative min-h-screen overflow-x-hidden">
        <div class="pointer-events-none fixed inset-0 overflow-hidden">
            <div class="animate-float-slow absolute -left-32 -top-32 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl"></div>
            <div class="animate-float-slow absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" style="animation-delay:2s"></div>
        </div>

        <header class="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
            <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div class="flex min-w-0 items-center gap-2.5">
                    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-fuchsia-500 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/30">🛡</div>
                    <div class="min-w-0 leading-tight">
                        <p class="truncate text-sm font-semibold text-white">Admin</p>
                        <p class="hidden text-[11px] text-slate-500 sm:block">User management</p>
                    </div>
                </div>
                <a href="<?= e(app_url('/')) ?>" class="flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white">
                    ‹ Back to planner
                </a>
            </div>
        </header>

        <div class="relative mx-auto max-w-5xl px-4 py-8 sm:px-6">
            <div class="animate-fade-in space-y-6">
                <?php if ($flash): ?>
                    <div class="<?= cn('rounded-lg border px-4 py-2 text-sm', ($flash['kind'] ?? 'ok') === 'error' ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200') ?>">
                        <?= e($flash['text']) ?>
                    </div>
                <?php endif; ?>
                <section class="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">Users</h1>
                        <p class="mt-1 text-sm text-slate-400"><?= $totalUsers ?> account<?= $totalUsers === 1 ? '' : 's' ?> registered</p>
                    </div>
                </section>

                <section class="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                    <table class="w-full text-left text-sm">
                        <thead class="border-b border-white/10 text-xs uppercase tracking-widest text-slate-500">
                            <tr>
                                <th class="px-4 py-3 font-medium">User</th>
                                <th class="px-4 py-3 font-medium">Role</th>
                                <th class="px-4 py-3 font-medium">Created</th>
                                <th class="px-4 py-3 font-medium">Goals</th>
                                <th class="px-4 py-3 font-medium">Follow-ups</th>
                                <th class="px-4 py-3 text-right font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5">
                            <?php foreach ($rows as $row): ?>
                                <tr class="transition hover:bg-white/[0.02]">
                                    <td class="px-4 py-3 font-medium text-white"><?= e($row['username']) ?></td>
                                    <td class="px-4 py-3">
                                        <span class="<?= cn('rounded-full px-2 py-0.5 text-[11px]', match ($row['role']) {
                                            'admin' => 'bg-amber-500/15 text-amber-200',
                                            'demo' => 'bg-sky-500/15 text-sky-200',
                                            default => 'bg-white/10 text-slate-300',
                                        }) ?>"><?= e($row['role']) ?></span>
                                    </td>
                                    <td class="px-4 py-3 text-slate-400"><?= e($row['created']) ?></td>
                                    <td class="px-4 py-3 text-slate-300"><?= $row['goals'] ?></td>
                                    <td class="px-4 py-3 text-slate-300"><?= $row['followUps'] ?></td>
                                    <td class="px-4 py-3 text-right">
                                        <?php if ($row['role'] === 'admin'): ?>
                                            <span class="text-[11px] text-slate-600">—</span>
                                        <?php else: ?>
                                            <form method="post" action="<?= e(app_url('/admin/action')) ?>" class="inline"
                                                  hx-confirm="Delete “<?= e($row['username']) ?>” and all of their data? This can't be undone.">
                                                <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
                                                <input type="hidden" name="action" value="deleteUser">
                                                <input type="hidden" name="username" value="<?= e($row['username']) ?>">
                                                <button type="submit" class="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-400 transition hover:border-rose-400/30 hover:text-rose-200">Delete</button>
                                            </form>
                                        <?php endif; ?>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </section>

                <p class="text-[11px] text-slate-500">The <span class="text-amber-200">admin</span> account (<?= e(ADMIN_USER) ?>) can't be deleted. The <span class="text-sky-200">demo</span> account re-seeds itself daily and is recreated automatically if removed.</p>
            </div>
        </div>
    </main>
    </div>
    <?php
    layout_foot();
}
