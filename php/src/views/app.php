<?php
// The main planner screen (Goals + Follow-ups tabs).
// Every interactive control is a small <form> that POSTs to /action and
// redirects back (Post/Redirect/Get), so the whole app is server-driven.

declare(strict_types=1);

const INPUT_CLASS = 'w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50';
const OUTREACH_BTN = 'rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200 transition hover:bg-white/10';

/** Hidden inputs every action form needs: CSRF + current tab/month context. */
function action_context(string $tab, string $monthKey): string
{
    return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">'
        . '<input type="hidden" name="tab" value="' . e($tab) . '">'
        . '<input type="hidden" name="month" value="' . e($monthKey) . '">';
}

function render_app_page(string $user, array $db, string $tab, string $monthKey, ?array $flash = null): void
{
    $goals = $db['goals'];
    $outreach = $db['outreachItems'];
    $cur = current_month_key();
    $isCurrentMonth = $monthKey === $cur;

    // Follow-up sorting / buckets.
    $urgency = function (array $o): int {
        return $o['followUpOn'] ? days_until($o['followUpOn']) : (days_since($o['lastAction']) * -1 + 999);
    };
    $sort = function (array $list) use ($urgency): array {
        usort($list, fn($a, $b) => $urgency($a) - $urgency($b));
        return $list;
    };
    $isFollowUpDue = fn(array $o) => $o['followUpOn'] !== null && days_until($o['followUpOn']) <= 0;

    $todoItems = $sort(array_values(array_filter($outreach, fn($o) => $o['stage'] === 'todo')));
    $waitingItems = $sort(array_values(array_filter($outreach, fn($o) => $o['stage'] === 'waiting')));
    $doneItems = array_values(array_filter($outreach, fn($o) => $o['stage'] === 'done'));
    $followUpDue = $sort(array_values(array_filter($outreach, fn($o) => $o['stage'] !== 'done' && $isFollowUpDue($o))));
    $needsAttention = count($todoItems) + count($followUpDue);

    // Goal-derived stats.
    $prayer = null;
    foreach ($goals as $g) {
        if ($g['category'] === 'prayer') { $prayer = $g; break; }
    }
    $prayerPercent = $prayer ? goal_percent($prayer, $monthKey) : 0;
    $todayPrayers = $prayer ? (int) ($prayer['dailyLog'][today_key()] ?? 0) : 0;
    $onPaceCount = count(array_filter($goals, fn($g) => goal_on_pace($g, $monthKey)));
    $daysLeft = $isCurrentMonth ? days_in_month($monthKey) - (int) date('j') : 0;

    layout_head('Rhythm · Personal Planner');
    ?>
    <main class="relative min-h-screen overflow-x-hidden">
        <div class="pointer-events-none fixed inset-0 overflow-hidden">
            <div class="animate-float-slow absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl"></div>
            <div class="animate-float-slow absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-fuchsia-500/10 blur-3xl" style="animation-delay:2s"></div>
            <div class="animate-float-slow absolute bottom-10 left-1/3 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" style="animation-delay:4s"></div>
        </div>

        <!-- Top navigation -->
        <header class="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
            <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div class="flex min-w-0 items-center gap-2.5">
                    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500 to-fuchsia-500 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/30">R</div>
                    <div class="min-w-0 leading-tight">
                        <p class="truncate text-sm font-semibold text-white">Rhythm</p>
                        <p class="hidden text-[11px] text-slate-500 sm:block"><?= e($user) ?><?= $user === DEMO_USER ? ' · demo' : '' ?></p>
                    </div>
                </div>

                <nav class="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
                    <?php $tabLabels = ['goals' => 'Goals', 'outreach' => 'Follow-ups']; ?>
                    <?php foreach (['goals', 'outreach'] as $t): ?>
                        <a href="<?= e(app_url('/?tab=' . $t . '&month=' . $monthKey)) ?>"
                           class="<?= cn('relative rounded-full px-3 py-1.5 text-sm font-medium transition sm:px-4', $tab === $t ? 'bg-linear-to-r from-cyan-500/20 to-fuchsia-500/20 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-200') ?>">
                            <?= e($tabLabels[$t]) ?>
                            <?php if ($t === 'outreach' && $needsAttention > 0): ?>
                                <span class="ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500/90 px-1 text-[10px] font-semibold text-white"><?= $needsAttention ?></span>
                            <?php endif; ?>
                        </a>
                    <?php endforeach; ?>
                </nav>

                <div class="flex shrink-0 items-center gap-2">
                    <?php if (is_admin($user)): ?>
                        <a href="<?= e(app_url('/admin')) ?>" title="Manage users"
                           class="flex h-9 items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 text-sm text-amber-100 transition hover:bg-amber-500/20">
                            <span aria-hidden>🛡</span><span class="hidden sm:inline">Admin</span>
                        </a>
                    <?php endif; ?>
                    <button type="button" onclick="document.getElementById('data-modal').showModal()"
                            class="flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white">
                        <span aria-hidden>⚙</span><span class="hidden sm:inline">Data</span>
                    </button>
                    <button type="button" onclick="document.getElementById('<?= $tab === 'outreach' ? 'add-outreach' : 'add-goal' ?>-modal').showModal()"
                            class="flex h-9 items-center gap-1.5 rounded-full bg-linear-to-r from-cyan-500 to-fuchsia-500 px-3.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110 sm:px-4">
                        <span aria-hidden class="text-base leading-none">+</span>
                        <span class="hidden sm:inline"><?= $tab === 'outreach' ? 'New contact' : 'New goal' ?></span>
                    </button>
                    <form method="post" action="<?= e(app_url('/logout')) ?>" class="contents">
                        <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
                        <button type="submit" title="Sign out"
                                class="flex h-9 items-center rounded-full border border-white/10 bg-white/5 px-3 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white">⎋</button>
                    </form>
                </div>
            </div>
        </header>

        <div class="relative mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <?php if ($tab === 'goals'): ?>
                <?php render_goals_tab($goals, $monthKey, $isCurrentMonth, $prayer, $prayerPercent, $todayPrayers, $onPaceCount, $daysLeft); ?>
            <?php else: ?>
                <?php render_outreach_tab($tab, $monthKey, $todoItems, $waitingItems, $doneItems, $followUpDue); ?>
            <?php endif; ?>
        </div>
    </main>

    <?php
    render_add_goal_dialog($tab, $monthKey);
    render_add_outreach_dialog($tab, $monthKey);
    render_data_dialog($tab, $monthKey);
    layout_foot();
}

// ---------- Goals tab ----------

function render_goals_tab(array $goals, string $monthKey, bool $isCurrentMonth, ?array $prayer, int $prayerPercent, int $todayPrayers, int $onPaceCount, int $daysLeft): void
{
    ?>
    <div class="animate-fade-in space-y-8">
        <section class="flex flex-wrap items-end justify-between gap-4">
            <div>
                <p class="text-sm text-slate-400"><?= e(format_long_date_now()) ?></p>
                <h1 class="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">Life goals</h1>
            </div>
            <div class="flex items-center gap-2">
                <a href="<?= e(app_url('/?tab=goals&month=' . add_month($monthKey, -1))) ?>" class="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10">‹</a>
                <div class="min-w-40 text-center text-sm font-semibold text-white"><?= e(month_label($monthKey)) ?></div>
                <a href="<?= e(app_url('/?tab=goals&month=' . add_month($monthKey, 1))) ?>" class="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10">›</a>
                <?php if (!$isCurrentMonth): ?>
                    <a href="<?= e(app_url('/?tab=goals&month=' . current_month_key())) ?>" class="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100 transition hover:bg-cyan-500/20">This month</a>
                <?php endif; ?>
            </div>
        </section>

        <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <?php
            stat_card('Prayers this month', $prayerPercent . '%', $prayer ? daily_done($prayer, $monthKey) . ' / ' . daily_target($prayer, $monthKey) : '—');
            stat_card("Today's prayers", $todayPrayers . '/' . ($prayer['perDay'] ?? 5), $isCurrentMonth ? 'so far today' : 'current day');
            stat_card('On pace', $onPaceCount . '/' . count($goals), 'goals keeping up');
            stat_card('Days left', $isCurrentMonth ? (string) $daysLeft : '—', $isCurrentMonth ? 'this month' : month_label($monthKey));
            ?>
        </section>

        <section class="grid gap-5 lg:grid-cols-2">
            <?php foreach ($goals as $goal): ?>
                <?php render_goal_card($goal, $monthKey, $isCurrentMonth); ?>
            <?php endforeach; ?>
        </section>
    </div>
    <?php
}

function stat_card(string $label, string $value, ?string $hint = null): void
{
    ?>
    <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
        <p class="text-xs uppercase tracking-widest text-slate-500"><?= e($label) ?></p>
        <p class="mt-1 text-2xl font-semibold text-white"><?= e($value) ?></p>
        <?php if ($hint !== null): ?><p class="mt-0.5 text-xs text-slate-400"><?= e($hint) ?></p><?php endif; ?>
    </div>
    <?php
}

function category_badge(string $category): void
{
    $meta = category_meta($category);
    ?>
    <span class="<?= cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', $meta['soft']) ?>">
        <span><?= $meta['icon'] ?></span><?= e($meta['label']) ?>
    </span>
    <?php
}

function pace_chip(bool $onPace): void
{
    ?>
    <span class="<?= cn('rounded-full px-2 py-0.5 text-[10px] font-medium', $onPace ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200') ?>"><?= $onPace ? 'on pace' : 'behind' ?></span>
    <?php
}

function bar(int $percent, string $gradient): void
{
    ?>
    <div class="h-2 overflow-hidden rounded-full bg-white/10">
        <div class="<?= cn('h-full rounded-full bg-linear-to-r', $gradient) ?>" style="width:<?= min(100, $percent) ?>%"></div>
    </div>
    <?php
}

function render_goal_card(array $goal, string $monthKey, bool $isCurrentMonth): void
{
    $meta = category_meta($goal['category']);
    $percent = goal_percent($goal, $monthKey);
    $onPace = goal_on_pace($goal, $monthKey);
    ?>
    <div class="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div class="mb-4 flex items-start justify-between gap-2">
            <div>
                <?php category_badge($goal['category']); ?>
                <h3 class="mt-2 text-lg font-semibold text-white"><?= e($goal['title']) ?></h3>
            </div>
            <div class="flex items-center gap-2">
                <?php pace_chip($onPace); ?>
                <?php if (empty($goal['locked'])): ?>
                    <form method="post" action="<?= e(app_url('/action')) ?>" onsubmit="return confirm('Delete this goal?')" class="contents">
                        <?= action_context('goals', $monthKey) ?>
                        <input type="hidden" name="action" value="deleteGoal">
                        <input type="hidden" name="goalId" value="<?= e($goal['id']) ?>">
                        <button type="submit" title="Delete goal" class="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-500 transition hover:border-rose-400/30 hover:text-rose-200">✕</button>
                    </form>
                <?php endif; ?>
            </div>
        </div>

        <?php if ($goal['type'] === 'daily'): ?>
            <?php render_daily_body($goal, $monthKey, $isCurrentMonth, $percent, $meta); ?>
        <?php elseif ($goal['type'] === 'count'): ?>
            <?php render_count_body($goal, $monthKey, $percent, $meta); ?>
        <?php else: ?>
            <?php render_project_body($goal, $monthKey, $percent, $meta); ?>
        <?php endif; ?>
    </div>
    <?php
}

function render_daily_body(array $goal, string $monthKey, bool $isCurrentMonth, int $percent, array $meta): void
{
    $perDay = (int) ($goal['perDay'] ?? 1);
    $total = days_in_month($monthKey);
    $done = daily_done($goal, $monthKey);
    $target = daily_target($goal, $monthKey);
    $todayNum = (int) date('j');
    $todayCount = (int) ($goal['dailyLog'][today_key()] ?? 0);
    ?>
    <div class="space-y-4">
        <div>
            <div class="mb-1 flex items-center justify-between text-sm">
                <span class="text-slate-400">Month completion</span>
                <span class="font-medium text-slate-200"><?= $done ?> / <?= $target ?> · <?= $percent ?>%</span>
            </div>
            <?php bar($percent, $meta['gradient']); ?>
        </div>

        <?php if ($isCurrentMonth): ?>
            <div class="rounded-xl border border-white/10 bg-black/20 p-3">
                <div class="mb-2 flex items-center justify-between">
                    <span class="text-xs uppercase tracking-widest text-slate-500">Today</span>
                    <span class="text-xs text-slate-400"><?= $todayCount ?>/<?= $perDay ?></span>
                </div>
                <div class="flex gap-1.5">
                    <?php for ($i = 0; $i < $perDay; $i++):
                        $filled = $i < $todayCount;
                        $newCount = ($filled && $todayCount === $i + 1) ? $i : $i + 1;
                    ?>
                        <form method="post" action="<?= e(app_url('/action')) ?>" class="flex-1">
                            <?= action_context('goals', $monthKey) ?>
                            <input type="hidden" name="action" value="setDay">
                            <input type="hidden" name="goalId" value="<?= e($goal['id']) ?>">
                            <input type="hidden" name="date" value="<?= e(today_key()) ?>">
                            <input type="hidden" name="count" value="<?= $newCount ?>">
                            <button type="submit" title="Mark <?= $i + 1 ?> done"
                                    class="<?= cn('h-8 w-full rounded-lg border text-xs transition', $filled ? cn('border-transparent bg-linear-to-r text-white', $meta['gradient']) : 'border-white/10 bg-white/5 text-slate-500 hover:bg-white/10') ?>"><?= $i + 1 ?></button>
                        </form>
                    <?php endfor; ?>
                </div>
            </div>
        <?php endif; ?>

        <div>
            <p class="mb-2 text-xs uppercase tracking-widest text-slate-500"><?= $isCurrentMonth ? 'This month · log today only' : 'Month history' ?></p>
            <div class="flex flex-wrap gap-1">
                <?php for ($day = 1; $day <= $total; $day++):
                    $key = day_key($monthKey, $day);
                    $count = (int) ($goal['dailyLog'][$key] ?? 0);
                    $frac = $perDay > 0 ? $count / $perDay : 0;
                    $isToday = $isCurrentMonth && $day === $todayNum;
                    $isPast = $isCurrentMonth ? $day < $todayNum : $monthKey < current_month_key();
                    $missed = $isPast && $count === 0;
                ?>
                    <div title="<?= e($monthKey . '-' . pad2($day)) ?>: <?= $count ?>/<?= $perDay ?>"
                         class="<?= cn(
                            'flex h-7 w-7 items-center justify-center rounded-md border text-[10px]',
                            $isToday ? 'border-cyan-400/60' : 'border-white/10',
                            ($frac == 0 && !$missed) ? 'bg-white/5 text-slate-600' : '',
                            $missed ? 'border-rose-500/30 bg-rose-500/10 text-rose-300/70' : '',
                            ($frac > 0 && $frac < 1) ? 'bg-emerald-500/30 text-emerald-100' : '',
                            ($frac >= 1) ? 'bg-emerald-500/70 text-white' : ''
                         ) ?>"><?= $day ?></div>
                <?php endfor; ?>
            </div>
        </div>
    </div>
    <?php
}

function render_count_body(array $goal, string $monthKey, int $percent, array $meta): void
{
    $target = (int) ($goal['monthlyTarget'] ?? 1);
    $done = count_done($goal, $monthKey);
    $unit = $goal['unit'] ?? 'times';
    $complete = $done >= $target;
    ?>
    <div class="space-y-4">
        <div class="flex items-center justify-between">
            <div>
                <p class="text-3xl font-bold text-white"><?= $done ?><span class="text-lg text-slate-500"> / <?= $target ?></span></p>
                <p class="text-xs text-slate-400"><?= e($unit) ?> this month</p>
            </div>
            <?php if ($complete): ?>
                <span class="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-200">Done ✓</span>
            <?php else: ?>
                <span class="text-sm text-slate-400"><?= $percent ?>%</span>
            <?php endif; ?>
        </div>

        <?php bar($percent, $meta['gradient']); ?>

        <?php if (!empty($goal['logEntries'])): ?>
            <div class="space-y-3">
                <form method="post" action="<?= e(app_url('/action')) ?>" class="flex gap-2">
                    <?= action_context('goals', $monthKey) ?>
                    <input type="hidden" name="action" value="addEntry">
                    <input type="hidden" name="goalId" value="<?= e($goal['id']) ?>">
                    <input name="label" placeholder="<?= $goal['category'] === 'reading' ? 'Book you read…' : 'What you made…' ?>" class="<?= cn(INPUT_CLASS, 'py-1.5') ?>">
                    <button type="submit" class="<?= cn('shrink-0 rounded-lg border border-transparent bg-linear-to-r px-4 py-1.5 text-sm font-medium text-white transition hover:brightness-110', $meta['gradient']) ?>">+ Log</button>
                </form>
                <?php $entries = count_entries($goal, $monthKey); ?>
                <?php if (count($entries) > 0): ?>
                    <ul class="space-y-1.5">
                        <?php foreach ($entries as $i => $label): ?>
                            <li class="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
                                <span class="min-w-0 truncate text-sm text-slate-200"><?= e($label) ?></span>
                                <form method="post" action="<?= e(app_url('/action')) ?>" class="contents">
                                    <?= action_context('goals', $monthKey) ?>
                                    <input type="hidden" name="action" value="removeEntry">
                                    <input type="hidden" name="goalId" value="<?= e($goal['id']) ?>">
                                    <input type="hidden" name="index" value="<?= $i ?>">
                                    <button type="submit" title="Remove" class="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-500 transition hover:border-rose-400/30 hover:text-rose-200">✕</button>
                                </form>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                <?php endif; ?>
            </div>
        <?php else: ?>
            <div class="flex gap-2">
                <form method="post" action="<?= e(app_url('/action')) ?>" class="contents">
                    <?= action_context('goals', $monthKey) ?>
                    <input type="hidden" name="action" value="count">
                    <input type="hidden" name="goalId" value="<?= e($goal['id']) ?>">
                    <input type="hidden" name="delta" value="-1">
                    <button type="submit" <?= $done === 0 ? 'disabled' : '' ?> class="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-40">−</button>
                </form>
                <form method="post" action="<?= e(app_url('/action')) ?>" class="flex-1">
                    <?= action_context('goals', $monthKey) ?>
                    <input type="hidden" name="action" value="count">
                    <input type="hidden" name="goalId" value="<?= e($goal['id']) ?>">
                    <input type="hidden" name="delta" value="1">
                    <button type="submit" class="<?= cn('w-full rounded-lg border border-transparent bg-linear-to-r px-4 py-1.5 text-sm font-medium text-white transition hover:brightness-110', $meta['gradient']) ?>">+ Log <?= e(preg_replace('/s$/', '', $unit)) ?></button>
                </form>
            </div>
        <?php endif; ?>
    </div>
    <?php
}

function render_project_body(array $goal, string $monthKey, int $percent, array $meta): void
{
    $steps = project_steps($goal, $monthKey);
    $elapsed = (int) round(month_elapsed_fraction($monthKey) * 100);
    $behind = $percent < $elapsed;
    ?>
    <div class="space-y-4">
        <div>
            <div class="mb-1 flex items-center justify-between text-sm">
                <span class="text-slate-400"><?= $monthKey === current_month_key() ? ('Day ' . (int) date('j') . ' of ' . days_in_month($monthKey)) : e(month_label($monthKey)) ?></span>
                <span class="<?= cn('font-medium', $behind ? 'text-amber-200' : 'text-emerald-200') ?>"><?= $percent ?>% done · <?= $elapsed ?>% of month</span>
            </div>
            <div class="relative h-2 overflow-hidden rounded-full bg-white/10">
                <div class="<?= cn('h-full rounded-full bg-linear-to-r', $meta['gradient']) ?>" style="width:<?= $percent ?>%"></div>
                <div class="absolute inset-y-0 w-0.5 bg-white/70" style="left:<?= $elapsed ?>%" title="Where you should be"></div>
            </div>
        </div>

        <div class="space-y-2">
            <?php foreach ($steps as $step): ?>
                <form method="post" action="<?= e(app_url('/action')) ?>" class="block">
                    <?= action_context('goals', $monthKey) ?>
                    <input type="hidden" name="action" value="step">
                    <input type="hidden" name="goalId" value="<?= e($goal['id']) ?>">
                    <input type="hidden" name="stepId" value="<?= e($step['id']) ?>">
                    <button type="submit" class="<?= cn('flex w-full cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-left transition', !empty($step['completed']) ? 'border-emerald-400/20 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:border-white/20') ?>">
                        <span class="<?= cn('flex h-4 w-4 items-center justify-center rounded border', !empty($step['completed']) ? 'border-emerald-400 bg-emerald-500 text-[10px] text-white' : 'border-white/20') ?>"><?= !empty($step['completed']) ? '✓' : '' ?></span>
                        <span class="<?= cn('text-sm font-medium', !empty($step['completed']) ? 'text-slate-400 line-through' : 'text-white') ?>"><?= e($step['title']) ?></span>
                    </button>
                </form>
            <?php endforeach; ?>
        </div>
    </div>
    <?php
}

// ---------- Outreach tab ----------

function render_outreach_tab(string $tab, string $monthKey, array $todoItems, array $waitingItems, array $doneItems, array $followUpDue): void
{
    ?>
    <div class="animate-fade-in space-y-6">
        <?php if (count($followUpDue) > 0): ?>
            <section class="rounded-2xl border border-rose-400/30 bg-rose-500/5 p-5">
                <div class="mb-3 flex items-center gap-2">
                    <span class="text-rose-300">⏰</span>
                    <h2 class="text-sm font-semibold text-rose-200">Follow-ups due</h2>
                    <span class="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-200"><?= count($followUpDue) ?></span>
                </div>
                <div class="grid gap-3 sm:grid-cols-2">
                    <?php foreach ($followUpDue as $item) render_outreach_card($item, $monthKey); ?>
                </div>
            </section>
        <?php endif; ?>

        <div class="grid gap-6 lg:grid-cols-2">
            <?php outreach_column('Your move', 'text-cyan-200', count($todoItems)); ?>
            <div class="space-y-3">
                <?php if (count($todoItems) === 0): ?>
                    <?php empty_hint("Nobody's waiting on you. Nice."); ?>
                <?php else: ?>
                    <?php foreach ($todoItems as $item) render_outreach_card($item, $monthKey); ?>
                <?php endif; ?>
            </div>
            </section>

            <?php outreach_column('Waiting on them', 'text-fuchsia-200', count($waitingItems)); ?>
            <div class="space-y-3">
                <?php if (count($waitingItems) === 0): ?>
                    <?php empty_hint('No pending replies.'); ?>
                <?php else: ?>
                    <?php foreach ($waitingItems as $item) render_outreach_card($item, $monthKey); ?>
                <?php endif; ?>
            </div>
            </section>
        </div>

        <?php if (count($doneItems) > 0): ?>
            <details class="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <summary class="cursor-pointer text-sm font-medium text-slate-300">Done · <?= count($doneItems) ?></summary>
                <div class="mt-3 grid gap-3 sm:grid-cols-2">
                    <?php foreach ($doneItems as $item) render_outreach_card($item, $monthKey); ?>
                </div>
            </details>
        <?php endif; ?>
    </div>
    <?php
}

function outreach_column(string $title, string $accent, int $count): void
{
    // Opens a <section> whose contents the caller fills, then closes </section>.
    ?>
    <section class="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div class="mb-4 flex items-center justify-between">
            <h2 class="<?= cn('text-sm font-semibold', $accent) ?>"><?= e($title) ?></h2>
            <span class="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300"><?= $count ?></span>
        </div>
    <?php
}

function empty_hint(string $text): void
{
    ?>
    <p class="rounded-xl border border-dashed border-white/10 py-6 text-center text-sm text-slate-500"><?= e($text) ?></p>
    <?php
}

function follow_up_chip(array $item): void
{
    if ($item['stage'] === 'done') {
        echo '<span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">closed</span>';
        return;
    }
    if (empty($item['followUpOn'])) {
        echo '<span class="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">' . days_since($item['lastAction']) . 'd since</span>';
        return;
    }
    $until = days_until($item['followUpOn']);
    if ($until < 0) {
        echo '<span class="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] text-rose-200">' . abs($until) . 'd overdue</span>';
    } elseif ($until === 0) {
        echo '<span class="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">due today</span>';
    } else {
        echo '<span class="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">in ' . $until . 'd</span>';
    }
}

function render_outreach_card(array $item, string $monthKey): void
{
    $channel = channel_meta($item['channel']);
    $overdue = $item['stage'] !== 'done' && $item['followUpOn'] !== null && days_until($item['followUpOn']) <= 0;
    $id = $item['id'];
    ?>
    <div class="<?= cn('rounded-xl border bg-black/20 p-3', $overdue ? 'border-rose-400/30' : 'border-white/10') ?>">
        <div class="mb-1.5 flex items-start justify-between gap-2">
            <div class="flex min-w-0 items-center gap-2">
                <span class="text-sm" title="<?= e($channel['label']) ?>"><?= $channel['icon'] ?></span>
                <div class="min-w-0">
                    <p class="truncate font-medium text-white"><?= e($item['name']) ?></p>
                    <p class="truncate text-xs text-slate-400"><?= e($item['topic']) ?></p>
                </div>
            </div>
            <?php follow_up_chip($item); ?>
        </div>

        <p class="mb-2 whitespace-pre-line text-xs leading-relaxed text-slate-300"><?= e($item['nextAction']) ?></p>

        <p class="mb-3 text-[11px] text-slate-500">
            Last touch <?= days_since($item['lastAction']) ?>d ago
            <?php if ($item['followUpOn'] && $item['stage'] !== 'done'): ?> · follow up <?= e(format_short_date($item['followUpOn'])) ?><?php endif; ?>
            <?php if (count($item['history']) > 0): ?> · <?= count($item['history']) ?> logged<?php endif; ?>
        </p>

        <div class="flex flex-wrap gap-1.5">
            <?php if ($item['stage'] === 'done'): ?>
                <?php outreach_action_button($monthKey, $id, 'setStage', ['stage' => 'todo'], '↩ Reopen', OUTREACH_BTN); ?>
            <?php else: ?>
                <?php outreach_action_button($monthKey, $id, 'touch', [], '✓ Log touch', 'rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/20', 'Record that you reached out; schedules a follow-up in 5 days'); ?>
                <?php if ($item['stage'] === 'waiting'): ?>
                    <?php outreach_action_button($monthKey, $id, 'snooze', ['days' => 3], '+3d', OUTREACH_BTN); ?>
                    <?php outreach_action_button($monthKey, $id, 'snooze', ['days' => 7], '+7d', OUTREACH_BTN); ?>
                <?php endif; ?>
                <?php outreach_action_button($monthKey, $id, 'setStage', ['stage' => $item['stage'] === 'todo' ? 'waiting' : 'todo'], $item['stage'] === 'todo' ? '→ Waiting' : '→ Your move', OUTREACH_BTN); ?>
                <?php outreach_action_button($monthKey, $id, 'setStage', ['stage' => 'done'], 'Done', 'rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-100 transition hover:bg-emerald-500/20'); ?>
            <?php endif; ?>
            <button type="button" onclick="document.getElementById('edit-<?= e($id) ?>').showModal()" class="<?= cn(OUTREACH_BTN, 'ml-auto') ?>">Edit</button>
            <form method="post" action="<?= e(app_url('/action')) ?>" onsubmit="return confirm('Delete this contact?')" class="contents">
                <?= action_context('outreach', $monthKey) ?>
                <input type="hidden" name="action" value="deleteOutreach">
                <input type="hidden" name="id" value="<?= e($id) ?>">
                <button type="submit" class="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-400 transition hover:border-rose-400/30 hover:text-rose-200">Delete</button>
            </form>
        </div>
    </div>

    <?php render_edit_outreach_dialog($item, $monthKey); ?>
    <?php
}

/** A one-button action form for outreach cards. */
function outreach_action_button(string $monthKey, string $id, string $action, array $fields, string $label, string $class, ?string $title = null): void
{
    ?>
    <form method="post" action="<?= e(app_url('/action')) ?>" class="contents">
        <?= action_context('outreach', $monthKey) ?>
        <input type="hidden" name="action" value="<?= e($action) ?>">
        <input type="hidden" name="id" value="<?= e($id) ?>">
        <?php foreach ($fields as $k => $v): ?>
            <input type="hidden" name="<?= e($k) ?>" value="<?= e((string) $v) ?>">
        <?php endforeach; ?>
        <button type="submit" class="<?= e($class) ?>"<?= $title ? ' title="' . e($title) . '"' : '' ?>><?= e($label) ?></button>
    </form>
    <?php
}

// ---------- Dialogs ----------

function modal_open(string $id, string $title): void
{
    ?>
    <dialog id="<?= e($id) ?>" class="fixed inset-0 m-auto">
        <div class="animate-fade-in relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-2xl">
            <div class="mb-4 flex items-center justify-between">
                <h2 class="text-lg font-semibold text-white"><?= e($title) ?></h2>
                <button type="button" onclick="this.closest('dialog').close()" class="text-slate-500 transition hover:text-white">✕</button>
            </div>
    <?php
}

function modal_close(): void
{
    echo '</div></dialog>';
}

function render_add_goal_dialog(string $tab, string $monthKey): void
{
    modal_open('add-goal-modal', 'New goal');
    ?>
    <form method="post" action="<?= e(app_url('/action')) ?>" class="space-y-4" id="add-goal-form">
        <?= action_context($tab, $monthKey) ?>
        <input type="hidden" name="action" value="createGoal">
        <div>
            <label class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Title</label>
            <input name="title" required placeholder="e.g. Meditate daily" class="<?= INPUT_CLASS ?>">
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Category</label>
                <select name="category" class="<?= INPUT_CLASS ?>">
                    <?php foreach (CATEGORIES as $c): $m = category_meta($c); ?>
                        <option value="<?= $c ?>" class="bg-slate-900"><?= $m['icon'] ?> <?= e($m['label']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div>
                <label class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Type</label>
                <select name="type" class="<?= INPUT_CLASS ?>" onchange="goalTypeChanged(this.value)">
                    <option value="count" class="bg-slate-900">Monthly count</option>
                    <option value="daily" class="bg-slate-900">Daily (N/day)</option>
                    <option value="project" class="bg-slate-900">Project (steps)</option>
                </select>
            </div>
        </div>

        <div data-goal-type="daily" hidden>
            <label class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Times per day</label>
            <input type="number" min="1" name="perDay" value="5" class="<?= INPUT_CLASS ?>">
        </div>
        <div data-goal-type="count">
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Monthly target</label>
                    <input type="number" min="1" name="monthlyTarget" value="3" class="<?= INPUT_CLASS ?>">
                </div>
                <div>
                    <label class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Unit</label>
                    <input name="unit" value="sessions" placeholder="sessions" class="<?= INPUT_CLASS ?>">
                </div>
            </div>
            <label class="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                <input type="checkbox" name="logEntries" value="1" class="h-4 w-4 rounded border-white/20 accent-cyan-500">
                Note what I did each time (e.g. book title, what I made)
            </label>
        </div>
        <div data-goal-type="project" hidden>
            <p class="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-400">Creates a monthly project with steps: Idea → Draft → Finish. It&apos;s paced against the calendar.</p>
        </div>

        <button type="submit" class="w-full rounded-lg bg-linear-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">Create goal</button>
    </form>
    <script>
        function goalTypeChanged(type) {
            document.querySelectorAll('#add-goal-form [data-goal-type]').forEach(function (el) {
                el.hidden = el.getAttribute('data-goal-type') !== type;
            });
        }
    </script>
    <?php
    modal_close();
}

function render_add_outreach_dialog(string $tab, string $monthKey): void
{
    modal_open('add-outreach-modal', 'New contact');
    ?>
    <form method="post" action="<?= e(app_url('/action')) ?>" class="space-y-4">
        <?= action_context($tab, $monthKey) ?>
        <input type="hidden" name="action" value="createOutreach">
        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Name</label>
                <input name="name" required placeholder="e.g. Jordan" class="<?= INPUT_CLASS ?>">
            </div>
            <div>
                <label class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Channel</label>
                <select name="channel" class="<?= INPUT_CLASS ?>">
                    <?php foreach (CHANNEL_META as $c => $m): ?>
                        <option value="<?= $c ?>" class="bg-slate-900"><?= $m['icon'] ?> <?= e($m['label']) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
        </div>
        <div>
            <label class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Topic</label>
            <input name="topic" placeholder="e.g. Podcast collab" class="<?= INPUT_CLASS ?>">
        </div>
        <div>
            <label class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Next action</label>
            <textarea name="nextAction" placeholder="Send update and ask for timeline." class="<?= cn(INPUT_CLASS, 'min-h-20') ?>"></textarea>
        </div>
        <div>
            <label class="mb-1 block text-xs uppercase tracking-widest text-slate-500">Remind me to follow up in (days)</label>
            <input type="number" min="0" name="followUpInDays" value="5" class="<?= INPUT_CLASS ?>">
            <p class="mt-1 text-[11px] text-slate-500">Set to 0 for no reminder.</p>
        </div>
        <button type="submit" class="w-full rounded-lg bg-linear-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">Add contact</button>
    </form>
    <?php
    modal_close();
}

function render_edit_outreach_dialog(array $item, string $monthKey): void
{
    modal_open('edit-' . $item['id'], 'Edit contact');
    ?>
    <form method="post" action="<?= e(app_url('/action')) ?>" class="space-y-2">
        <?= action_context('outreach', $monthKey) ?>
        <input type="hidden" name="action" value="updateOutreach">
        <input type="hidden" name="id" value="<?= e($item['id']) ?>">
        <input name="name" value="<?= e($item['name']) ?>" class="<?= cn(INPUT_CLASS, 'py-1.5') ?>" placeholder="Name">
        <input name="topic" value="<?= e($item['topic']) ?>" class="<?= cn(INPUT_CLASS, 'py-1.5') ?>" placeholder="Topic">
        <div class="flex gap-2">
            <select name="channel" class="<?= cn(INPUT_CLASS, 'py-1.5') ?>">
                <?php foreach (CHANNEL_META as $c => $m): ?>
                    <option value="<?= $c ?>" <?= $item['channel'] === $c ? 'selected' : '' ?> class="bg-slate-900"><?= $m['icon'] ?> <?= e($m['label']) ?></option>
                <?php endforeach; ?>
            </select>
            <input type="date" name="followUpOn" value="<?= e($item['followUpOn'] ?? '') ?>" class="<?= cn(INPUT_CLASS, 'py-1.5') ?>">
        </div>
        <textarea name="nextAction" class="<?= cn(INPUT_CLASS, 'min-h-16 py-1.5') ?>" placeholder="Next action"><?= e($item['nextAction']) ?></textarea>
        <div class="mt-2 flex gap-2">
            <button type="submit" class="flex-1 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/20">Save</button>
            <button type="button" onclick="this.closest('dialog').close()" class="<?= OUTREACH_BTN ?>">Cancel</button>
        </div>
    </form>
    <?php
    modal_close();
}

function render_data_dialog(string $tab, string $monthKey): void
{
    modal_open('data-modal', 'Backup & restore');
    ?>
    <div class="space-y-5">
        <p class="text-sm text-slate-400">Your planner is stored on the server under your account. Export a backup, import one to restore, or reset back to the starter data.</p>
        <div class="space-y-2">
            <a href="<?= e(app_url('/export')) ?>" hx-boost="false" class="block w-full rounded-lg bg-linear-to-r from-cyan-500 to-fuchsia-500 px-4 py-2 text-center text-sm font-semibold text-white transition hover:brightness-110">⬇ Export backup (.json)</a>

            <form method="post" action="<?= e(app_url('/import')) ?>" enctype="multipart/form-data" hx-boost="false">
                <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
                <input type="file" name="file" accept="application/json,.json" required
                       onchange="document.getElementById('import-submit').disabled = !this.files.length"
                       class="w-full cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-slate-200 hover:bg-white/10">
                <button type="submit" id="import-submit" disabled
                        class="mt-2 block w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-center text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-40">⬆ Import backup…</button>
            </form>
            <p class="text-[11px] text-slate-500">Importing replaces everything currently stored. Consider exporting first.</p>
        </div>
        <div class="border-t border-white/10 pt-4">
            <form method="post" action="<?= e(app_url('/action')) ?>" hx-confirm="Reset all data back to the starter data? This can't be undone.">
                <?= action_context($tab, $monthKey) ?>
                <input type="hidden" name="action" value="reset">
                <button type="submit" class="w-full rounded-lg border border-rose-400/20 bg-rose-500/5 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-500/10">Reset to starter data</button>
            </form>
        </div>
    </div>
    <?php
    modal_close();
}
