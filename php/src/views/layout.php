<?php
// Shared HTML shell: head metadata, htmx, and the built production stylesheet.

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
    <!-- PWA: installable, offline-friendly app shell -->
    <link rel="manifest" href="<?= e(app_url('/manifest.webmanifest')) ?>">
    <meta name="theme-color" content="#020617">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Rhythm">
    <link rel="icon" href="<?= e(app_url('/icon.svg')) ?>" type="image/svg+xml">
    <link rel="apple-touch-icon" href="<?= e(app_url('/icon.svg')) ?>">
    <!-- Keep scroll position when htmx swaps in updated content after an action. -->
    <meta name="htmx-config" content='{"scrollIntoViewOnBoost": false}'>
    <style>
        .htmx-indicator {
            opacity: 0;
            transition: opacity .18s ease;
        }

        /*noinspection CssUnusedSymbol */
        .htmx-request .htmx-indicator,
        .htmx-request.htmx-indicator {
            opacity: 1;
        }
    </style>
    <script src="https://unpkg.com/htmx.org@4/dist/htmx.min.js"></script>
    <link rel="stylesheet" href="<?= e(app_url('/php/public/app.css')) ?>">
    <script>
        // Register the service worker so Rhythm can be installed as a PWA.
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
                navigator.serviceWorker.register('<?= e(app_url('/sw.js')) ?>').catch(function () {});
            });
        }
    </script>
</head>
<!-- hx-boost turns every link/form into an AJAX request that swaps the app shell,
     so actions update in place instead of forcing full page reloads. -->
<body data-hx-boost="true" data-hx-target="#page-shell" data-hx-select="#page-shell" data-hx-swap="outerHTML show:window:top" data-hx-indicator="#htmx-indicator" class="min-h-full flex flex-col bg-slate-950 text-slate-100">
<div id="htmx-indicator" class="htmx-indicator pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 bg-linear-to-r from-cyan-500 via-fuchsia-500 to-amber-400"></div>
<?php
}

function layout_foot(): void
{
    ?>
</body>
</html>
<?php
}
