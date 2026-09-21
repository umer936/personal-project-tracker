<?php
// Wrapper entry point for traditional Apache/PHP hosting from /proj_tracker/.
// Keep SCRIPT_NAME anchored at this file so URL generation stays under the
// subdirectory instead of assuming the site root.

declare(strict_types=1);

require __DIR__ . '/php/public/index.php';
