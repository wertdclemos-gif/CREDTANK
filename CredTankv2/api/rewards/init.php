<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/engine.php';
require_once __DIR__ . '/repository.php';

try {
    $pdo = rewards_db_connect();
    rewards_bootstrap_schema($pdo);
    rewards_seed_default_settings($pdo);
} catch (Throwable $e) {
    rewards_json_response([
        'ok' => false,
        'error' => 'db_unavailable',
        'details' => $e->getMessage(),
    ], 500);
}

$rules = rewards_load_rules($pdo);
