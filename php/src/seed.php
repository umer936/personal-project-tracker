<?php
// Default planner contents used to seed a brand-new user's store and to reset
// the demo account each day.

declare(strict_types=1);

/** The core life goals — shared by both the real seed and the demo seed. */
function default_goals(): array
{
    return [
        ['id' => 'prayer', 'title' => 'Pray 5× daily', 'category' => 'prayer', 'type' => 'daily', 'locked' => true, 'perDay' => 5, 'dailyLog' => [], 'months' => [], 'notes' => ''],
        ['id' => 'exercise', 'title' => 'Exercise', 'category' => 'exercise', 'type' => 'count', 'monthlyTarget' => 3, 'unit' => 'sessions', 'dailyLog' => [], 'months' => [], 'notes' => '', 'locked' => true],
        ['id' => 'stretch', 'title' => 'Stretch', 'category' => 'stretch', 'type' => 'count', 'monthlyTarget' => 3, 'unit' => 'sessions', 'dailyLog' => [], 'months' => [], 'notes' => '', 'locked' => true],
        ['id' => 'reading', 'title' => 'Read a book', 'category' => 'reading', 'type' => 'count', 'monthlyTarget' => 1, 'unit' => 'books', 'logEntries' => true, 'dailyLog' => [], 'months' => [], 'notes' => '', 'locked' => true],
        ['id' => 'blog', 'title' => 'Write a blog post', 'category' => 'blog', 'type' => 'count', 'monthlyTarget' => 1, 'unit' => 'posts', 'logEntries' => true, 'dailyLog' => [], 'months' => [], 'notes' => '', 'locked' => true],
        ['id' => 'craft', 'title' => 'Make something (draw / crochet / Cricut)', 'category' => 'craft', 'type' => 'count', 'monthlyTarget' => 1, 'unit' => 'pieces', 'logEntries' => true, 'dailyLog' => [], 'months' => [], 'notes' => '', 'locked' => true],
        ['id' => 'finance', 'title' => 'Finance / accounts check', 'category' => 'finance', 'type' => 'count', 'monthlyTarget' => 1, 'unit' => 'checks', 'dailyLog' => [], 'months' => [], 'notes' => '', 'locked' => true],
        ['id' => 'rest', 'title' => 'Take a no-work day (no projects)', 'category' => 'rest', 'type' => 'count', 'monthlyTarget' => 1, 'unit' => 'days', 'dailyLog' => [], 'months' => [], 'notes' => '', 'locked' => true],
        ['id' => 'soccer', 'title' => 'Soccer training', 'category' => 'soccer', 'type' => 'count', 'monthlyTarget' => 1, 'unit' => 'sessions', 'logEntries' => true, 'dailyLog' => [], 'months' => [], 'notes' => '', 'locked' => true],
        ['id' => 'video', 'title' => 'Publish a YouTube video', 'category' => 'video', 'type' => 'project', 'stepTemplate' => ['Idea', 'Script', 'Record', 'Edit', 'Thumbnail', 'Publish'], 'dailyLog' => [], 'months' => [], 'notes' => '', 'locked' => true],
        ['id' => 'home', 'title' => 'House project', 'category' => 'home', 'type' => 'count', 'monthlyTarget' => 1, 'unit' => 'projects', 'logEntries' => true, 'options' => ['Deep-clean the garage', 'Touch-up paint the hallway', 'Organize the pantry', 'Service the HVAC filter', 'Declutter the closet'], 'dailyLog' => [], 'months' => [], 'notes' => '', 'locked' => true],
    ];
}

/** Default per-user preferences. All sections visible out of the box. */
function default_settings(): array
{
    return [
        'showGoals' => true,
        'showFollowups' => true,
        'showBooks' => true,
    ];
}

/** A couple of sample books so the Book log tab isn't empty on a fresh account. */
function sample_books(): array
{
    return [
        [
            'id' => 'the-midnight-library',
            'title' => 'The Midnight Library',
            'author' => 'Matt Haig',
            'readingTime' => '3h 10m',
            'pages' => 288,
            'finishedOn' => '',
            'bookClub' => false,
            'notes' => [
                ['text' => 'Currently reading — the premise about regrets is gripping.', 'page' => null],
            ],
        ],
        [
            'id' => 'atomic-habits',
            'title' => 'Atomic Habits',
            'author' => 'James Clear',
            'readingTime' => '6h 20m',
            'pages' => 320,
            'finishedOn' => date('Y-m-d', strtotime('-20 days')),
            'bookClub' => true,
            'notes' => [
                ['text' => 'You do not rise to the level of your goals, you fall to the level of your systems.', 'page' => 27],
                ['text' => 'Loved the idea of habit stacking — worth trying next month.', 'page' => null],
            ],
        ],
        [
            'id' => 'the-pragmatic-programmer',
            'title' => 'The Pragmatic Programmer',
            'author' => 'Hunt & Thomas',
            'readingTime' => '9h',
            'pages' => 352,
            'finishedOn' => date('Y-m-d', strtotime('-70 days')),
            'bookClub' => false,
            'notes' => [
                ['text' => 'DRY — Don\'t Repeat Yourself.', 'page' => 30],
            ],
        ],
    ];
}

/** Sample follow-up contacts (all fictional). Dates are relative to "today" so
 *  a freshly seeded account always looks alive. */
function sample_outreach(): array
{
    $ago = fn(int $d) => date('Y-m-d', strtotime("-{$d} days"));
    $in = fn(int $d) => date('Y-m-d', strtotime("+{$d} days"));
    $today = date('Y-m-d');

    return [
        ['id' => 'jordan-rivera', 'name' => 'Jordan Rivera', 'topic' => 'Podcast collab', 'channel' => 'dm', 'stage' => 'todo', 'lastAction' => $ago(1), 'followUpOn' => $today, 'nextAction' => 'Pitch a joint episode on side projects.', 'history' => []],
        ['id' => 'sam-okafor', 'name' => 'Sam Okafor', 'topic' => 'Coffee chat', 'channel' => 'text', 'stage' => 'todo', 'lastAction' => $ago(6), 'followUpOn' => $ago(2), 'nextAction' => 'Suggest a time to grab coffee next week.', 'history' => []],
        ['id' => 'priya-nair', 'name' => 'Priya Nair', 'topic' => 'Mentorship', 'channel' => 'email', 'stage' => 'waiting', 'lastAction' => $ago(3), 'followUpOn' => $in(4), 'nextAction' => 'Wait for her notes on the portfolio draft.', 'history' => [['date' => $ago(3), 'note' => 'Sent portfolio draft for feedback.']]],
        ['id' => 'diego-fuentes', 'name' => 'Diego Fuentes', 'topic' => 'Freelance gig', 'channel' => 'email', 'stage' => 'todo', 'lastAction' => $ago(2), 'followUpOn' => null, 'nextAction' => 'Send a rough scope and rate.', 'history' => []],
        ['id' => 'mia-thompson', 'name' => 'Mia Thompson', 'topic' => 'Book club', 'channel' => 'text', 'stage' => 'waiting', 'lastAction' => $ago(4), 'followUpOn' => $in(2), 'nextAction' => 'See if she is in for next month\'s pick.', 'history' => [['date' => $ago(4), 'note' => 'Shared the shortlist of titles.']]],
        ['id' => 'leo-martins', 'name' => 'Leo Martins', 'topic' => 'Open-source PR', 'channel' => 'dm', 'stage' => 'done', 'lastAction' => $ago(8), 'followUpOn' => null, 'nextAction' => 'Merged the fix and thanked him.', 'history' => []],
        ['id' => 'hannah-kim', 'name' => 'Hannah Kim', 'topic' => 'Newsletter swap', 'channel' => 'email', 'stage' => 'todo', 'lastAction' => $ago(1), 'followUpOn' => $in(6), 'nextAction' => 'Propose a cross-promo for next issue.', 'history' => []],
        ['id' => 'omar-haddad', 'name' => 'Omar Haddad', 'topic' => 'Conference intro', 'channel' => 'meet', 'stage' => 'done', 'lastAction' => $ago(12), 'followUpOn' => null, 'nextAction' => 'Met at the meetup and swapped contacts.', 'history' => [['date' => $ago(12), 'note' => 'Great chat about design systems.']]],
        ['id' => 'grace-bennett', 'name' => 'Grace Bennett', 'topic' => 'Portfolio review', 'channel' => 'call', 'stage' => 'todo', 'lastAction' => $ago(5), 'followUpOn' => $ago(1), 'nextAction' => 'Schedule a 20-min review call.', 'history' => []],
        ['id' => 'noah-schneider', 'name' => 'Noah Schneider', 'topic' => 'Side project', 'channel' => 'email', 'stage' => 'waiting', 'lastAction' => $ago(2), 'followUpOn' => $in(5), 'nextAction' => 'Waiting to hear if he wants to co-build it.', 'history' => [['date' => $ago(2), 'note' => 'Sent the idea one-pager.']]],
    ];
}

/** The seed used for new accounts: the core goals plus the sample follow-ups. */
function default_database(): array
{
    return [
        'version' => 2,
        'goals' => default_goals(),
        'outreachItems' => sample_outreach(),
        'books' => sample_books(),
        'history' => [],
        'deletedCoreGoals' => [],
        'settings' => default_settings(),
    ];
}

/**
 * The demo seed — identical to a new account. It exists separately so the demo
 * can be reset to this state once per day without touching real accounts.
 */
function demo_database(): array
{
    return [
        'version' => 2,
        'goals' => default_goals(),
        'outreachItems' => sample_outreach(),
        'books' => sample_books(),
        'history' => [],
        'deletedCoreGoals' => [],
        'settings' => default_settings(),
    ];
}
