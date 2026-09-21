<?php
// The change-history screen: a timeline of edits with undo / rollback.

declare(strict_types=1);

function render_history_page(string $user, array $db, ?array $flash = null): void
{
    $history = $db['history'] ?? [];
    $count = count($history);

    layout_head('History · Rhythm');
    ?>
    <div id="page-shell">
    <main class="relative min-h-screen overflow-x-hidden">
        <div class="pointer-events-none fixed inset-0 overflow-hidden">
            <div class="animate-float-slow absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl"></div>
            <div class="animate-float-slow absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" style="animation-delay:2s"></div>
        </div>

        <header class="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
            <div class="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div class="flex min-w-0 items-center gap-2.5">
                    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500 to-fuchsia-500 text-base shadow-lg shadow-fuchsia-500/30">🕑</div>
                    <div class="min-w-0 leading-tight">
                        <p class="truncate text-sm font-semibold text-white">History</p>
                        <p class="hidden text-[11px] text-slate-500 sm:block">Undo &amp; roll back changes</p>
                    </div>
                </div>
                <a href="<?= e(app_url('/')) ?>" class="flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white">
                    ‹ Back to planner
                </a>
            </div>
        </header>

        <div class="relative mx-auto max-w-4xl px-4 py-8 sm:px-6">
            <div class="animate-fade-in space-y-6">
                <?php if ($flash): ?>
                    <div class="<?= cn('rounded-lg border px-4 py-2 text-sm', ($flash['kind'] ?? 'ok') === 'error' ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200') ?>">
                        <?= e($flash['text']) ?>
                    </div>
                <?php endif; ?>

                <section class="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">Change history</h1>
                        <p class="mt-1 text-sm text-slate-400"><?= $count ?> saved point<?= $count === 1 ? '' : 's' ?> · restoring any version can itself be undone.</p>
                    </div>
                    <?php if ($count > 0): ?>
                        <div class="flex items-center gap-2">
                            <form method="post" action="<?= e(app_url('/history/action')) ?>" class="contents">
                                <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
                                <input type="hidden" name="action" value="undo">
                                <button type="submit" class="flex h-9 items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 text-sm text-cyan-100 transition hover:bg-cyan-500/20">↶ Undo last</button>
                            </form>
                            <form method="post" action="<?= e(app_url('/history/action')) ?>" data-hx-confirm="Clear the entire change history? Your current data stays, but you'll no longer be able to undo past changes." class="contents">
                                <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
                                <input type="hidden" name="action" value="clearHistory">
                                <button type="submit" class="flex h-9 items-center rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-300 transition hover:bg-white/10">Clear</button>
                            </form>
                        </div>
                    <?php endif; ?>
                </section>

                <?php if ($count === 0): ?>
                    <p class="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
                        No changes recorded yet. As you edit goals, follow-ups, and books, each change is saved here so you can undo it or roll back.
                    </p>
                <?php else: ?>
                    <section class="space-y-2">
                        <?php
                        // Newest first, but keep each entry's original index for rollback.
                        for ($i = $count - 1; $i >= 0; $i--):
                            $entry = $history[$i];
                            $state = $entry['state'] ?? [];
                            $goals = count($state['goals'] ?? []);
                            $items = count($state['outreachItems'] ?? []);
                            $books = count($state['books'] ?? []);
                            $ts = (int) ($entry['ts'] ?? time());
                        ?>
                            <div class="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                                <div class="flex min-w-0 items-center gap-3">
                                    <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-slate-400"><?= $count - $i ?></span>
                                    <div class="min-w-0">
                                        <p class="truncate text-sm font-medium text-white"><?= e($entry['label'] ?? 'Change') ?></p>
                                        <p class="truncate text-[11px] text-slate-500">
                                            <?= e(format_relative_time($ts)) ?>
                                            · <?= $goals ?> goals · <?= $items ?> contacts · <?= $books ?> books
                                        </p>
                                    </div>
                                </div>
                                <form method="post" action="<?= e(app_url('/history/action')) ?>" data-hx-confirm="Restore your planner to this earlier version? Your current state is saved first, so you can undo the restore." class="contents">
                                    <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
                                    <input type="hidden" name="action" value="rollback">
                                    <input type="hidden" name="index" value="<?= $i ?>">
                                    <button type="submit" class="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-400/30 hover:bg-cyan-500/10 hover:text-cyan-100">↺ Restore</button>
                                </form>
                            </div>
                        <?php endfor; ?>
                    </section>
                <?php endif; ?>
            </div>
        </div>
    </main>
    </div>
    <?php
    layout_foot();
}
