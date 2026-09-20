<?php
// Shared HTML shell: <head> with Tailwind CDN + our CSS, and a closing footer.

declare(strict_types=1);

function layout_head(string $title): void
{
    ?>
<!doctype html>
<html lang="en" class="h-full antialiased">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($title) ?></title>
    <meta name="description" content="A calm, focused personal planner: recurring rhythms, monthly progress, and an outreach inbox.">
    <!-- Keep scroll position when htmx swaps in updated content after an action. -->
    <meta name="htmx-config" content='{"scrollIntoViewOnBoost": false}'>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/htmx.org@4/dist/htmx.min.js"></script>
    <link rel="stylesheet" href="/app.css">
</head>
<!-- hx-boost turns every link/form into an AJAX request that swaps the page body,
     so actions update in place instead of reloading. Works without JS too. -->
<body hx-boost="true" class="min-h-full flex flex-col bg-slate-950 text-slate-100">
<?php
}

function layout_foot(): void
{
    ?>
</body>
</html>
<?php
}
