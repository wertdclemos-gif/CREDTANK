<?php
declare(strict_types=1);

require_once __DIR__ . '/init.php';

rewards_require_method('GET');

$userId = trim((string) ($_GET['user_id'] ?? ''));
if ($userId === '') {
    rewards_json_response(['ok' => false, 'error' => 'missing_user_id'], 422);
}

try {
    $pdo->beginTransaction();

    rewards_ensure_user_and_account($pdo, $userId);
    rewards_lock_account($pdo, $userId);

    rewards_release_matured_pending($pdo, $rules, $userId);
    rewards_apply_expirations($pdo, $rules, $userId);

    $tier = rewards_sync_user_tier($pdo, $userId, $rules, rewards_now());
    $balance = rewards_recompute_account($pdo, $userId);
    $expiringSoon = rewards_get_expiring_soon($pdo, $userId);

    $stmt = $pdo->prepare(
        'SELECT * FROM reward_ledgers WHERE user_id = ? ORDER BY created_at DESC LIMIT 30'
    );
    $stmt->execute([$userId]);
    $recent = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $pdo->commit();

    rewards_json_response([
        'ok' => true,
        'user_id' => $userId,
        'tier' => $tier,
        'balance' => [
            'points_available' => $balance['points_available'],
            'points_pending' => $balance['points_pending'],
            'cashback_available' => rewards_cents_to_decimal($balance['cashback_available_cents']),
            'cashback_pending' => rewards_cents_to_decimal($balance['cashback_pending_cents']),
            'points_expiring_soon' => $expiringSoon['points'],
            'cashback_expiring_soon' => rewards_cents_to_decimal($expiringSoon['cashback_cents']),
        ],
        'recent_ledger' => array_map('rewards_ledger_row_to_api', $recent),
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    rewards_json_response(['ok' => false, 'error' => 'balance_failed', 'details' => $e->getMessage()], 500);
}
