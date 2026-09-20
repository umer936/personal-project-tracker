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
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="/app.css">
</head>
<body class="min-h-full flex flex-col bg-slate-950 text-slate-100">
<?php
}

function layout_foot(): void
{
    ?>
</body>
</html>
<?php
}
