<?php
declare(strict_types=1);

require_once __DIR__ . '/init.php';

rewards_require_method('POST');
$in = rewards_read_json_body();

$externalTxId = trim((string) ($in['external_transaction_id'] ?? ''));
if ($externalTxId === '') {
    rewards_json_response(['ok' => false, 'error' => 'missing_external_transaction_id'], 422);
}

$confirmedAt = rewards_parse_datetime($in['confirmed_at'] ?? rewards_now()->format(DATE_ATOM));

try {
    $pdo->beginTransaction();

    $earnRows = rewards_fetch_earn_rows_by_external($pdo, $externalTxId);
    if (!$earnRows) {
        $pdo->commit();
        rewards_json_response(['ok' => false, 'error' => 'earn_not_found'], 404);
    }

    $update = $pdo->prepare('UPDATE reward_ledgers SET status = ?, available_at = ?, expires_at = ? WHERE id = ?');
    $affectedUsers = [];
    $updatedCount = 0;

    foreach ($earnRows as $row) {
        $affectedUsers[(string) $row['user_id']] = true;
        if (($row['status'] ?? '') !== 'PENDING') {
            continue;
        }
        $availableAt = $confirmedAt;
        $expiresAt = rewards_compute_expiration_schedule((string) $row['type'], $availableAt, $rules);
        $update->execute(['AVAILABLE', $availableAt->format('Y-m-d H:i:s'), $expiresAt, $row['id']]);
        $updatedCount++;
    }

    $balances = [];
    foreach (array_keys($affectedUsers) as $uid) {
        rewards_ensure_user_and_account($pdo, $uid);
        rewards_lock_account($pdo, $uid);
        rewards_release_matured_pending($pdo, $rules, $uid);
        rewards_apply_expirations($pdo, $rules, $uid);
        $tier = rewards_sync_user_tier($pdo, $uid, $rules, $confirmedAt);
        $balance = rewards_recompute_account($pdo, $uid);
        $balances[$uid] = [
            'tier' => $tier,
            'points_available' => $balance['points_available'],
            'points_pending' => $balance['points_pending'],
            'cashback_available' => rewards_cents_to_decimal($balance['cashback_available_cents']),
            'cashback_pending' => rewards_cents_to_decimal($balance['cashback_pending_cents']),
        ];
    }

    $ledgerRows = rewards_fetch_earn_rows_by_external($pdo, $externalTxId);

    $pdo->commit();

    rewards_json_response([
        'ok' => true,
        'external_transaction_id' => $externalTxId,
        'updated' => $updatedCount,
        'ledger' => array_map('rewards_ledger_row_to_api', $ledgerRows),
        'balances' => $balances,
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    rewards_json_response(['ok' => false, 'error' => 'confirm_failed', 'details' => $e->getMessage()], 500);
}
