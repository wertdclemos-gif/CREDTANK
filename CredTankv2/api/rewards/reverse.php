<?php
declare(strict_types=1);

require_once __DIR__ . '/init.php';

rewards_require_method('POST');
$in = rewards_read_json_body();

$externalTxId = trim((string) ($in['external_transaction_id'] ?? ''));
$reason = trim((string) ($in['reason'] ?? 'manual_reversal'));

if ($externalTxId === '') {
    rewards_json_response(['ok' => false, 'error' => 'missing_external_transaction_id'], 422);
}

$createdBy = trim((string) ($in['created_by'] ?? 'system'));
$source = trim((string) ($in['source'] ?? 'api'));
$metadata = rewards_extract_audit_metadata($in);
$metadata['reason'] = $reason;
$metadata['original_external_transaction_id'] = $externalTxId;

try {
    $pdo->beginTransaction();

    $existingReversal = rewards_fetch_reversal_by_original_external($pdo, $externalTxId);
    if ($existingReversal) {
        $users = [];
        foreach ($existingReversal as $row) {
            $users[(string) $row['user_id']] = true;
        }

        $balances = [];
        foreach (array_keys($users) as $uid) {
            rewards_ensure_user_and_account($pdo, $uid);
            rewards_lock_account($pdo, $uid);
            $balance = rewards_recompute_account($pdo, $uid);
            $balances[$uid] = [
                'points_available' => $balance['points_available'],
                'points_pending' => $balance['points_pending'],
                'cashback_available' => rewards_cents_to_decimal($balance['cashback_available_cents']),
                'cashback_pending' => rewards_cents_to_decimal($balance['cashback_pending_cents']),
            ];
        }

        $pdo->commit();
        rewards_json_response([
            'ok' => true,
            'idempotent' => true,
            'ledger' => array_map('rewards_ledger_row_to_api', $existingReversal),
            'balances' => $balances,
        ]);
    }

    $earnRows = rewards_fetch_earn_rows_by_external($pdo, $externalTxId);
    if (!$earnRows) {
        $pdo->commit();
        rewards_json_response(['ok' => false, 'error' => 'earn_not_found'], 404);
    }

    $affectedUsers = [];
    foreach ($earnRows as $row) {
        $affectedUsers[(string) $row['user_id']] = true;
    }

    foreach (array_keys($affectedUsers) as $uid) {
        rewards_ensure_user_and_account($pdo, $uid);
        rewards_lock_account($pdo, $uid);
    }

    foreach ($earnRows as $row) {
        $points = (int) ($row['amount_points'] ?? 0);
        $cashbackCents = rewards_money_to_cents((string) ($row['amount_cashback'] ?? '0'));

        if ($points === 0 && $cashbackCents === 0) {
            continue;
        }

        rewards_upsert_ledger($pdo, [
            'id' => rewards_uuid_v4(),
            'event_key' => 'reversal:' . $row['id'],
            'user_id' => $row['user_id'],
            'external_transaction_id' => 'REV-' . $externalTxId,
            'type' => 'REVERSAL',
            'status' => 'AVAILABLE',
            'amount_points' => -$points,
            'amount_cashback_cents' => -$cashbackCents,
            'base_amount_cents' => rewards_money_to_cents((string) ($row['base_amount'] ?? '0')),
            'eligible_amount_cents' => rewards_money_to_cents((string) ($row['eligible_amount'] ?? '0')),
            'related_ledger_id' => $row['id'],
            'metadata' => $metadata,
            'created_by' => $createdBy,
            'source' => $source,
        ]);

        rewards_metric_increment($pdo, 'reversal_points', (float) max(0, $points));
        rewards_metric_increment($pdo, 'reversal_cashback_cents', (float) max(0, $cashbackCents));
    }

    $cancelStmt = $pdo->prepare(
        "UPDATE reward_ledgers
         SET status = 'CANCELED'
         WHERE external_transaction_id = ?
           AND type IN ('EARN_POINTS', 'EARN_CASHBACK')"
    );
    $cancelStmt->execute([$externalTxId]);

    $balances = [];
    foreach (array_keys($affectedUsers) as $uid) {
        rewards_apply_expirations($pdo, $rules, $uid);
        $balance = rewards_recompute_account($pdo, $uid);
        $balances[$uid] = [
            'points_available' => $balance['points_available'],
            'points_pending' => $balance['points_pending'],
            'cashback_available' => rewards_cents_to_decimal($balance['cashback_available_cents']),
            'cashback_pending' => rewards_cents_to_decimal($balance['cashback_pending_cents']),
        ];
    }

    $reversalRows = rewards_fetch_reversal_by_original_external($pdo, $externalTxId);

    $pdo->commit();

    rewards_json_response([
        'ok' => true,
        'external_transaction_id' => $externalTxId,
        'reason' => $reason,
        'ledger' => array_map('rewards_ledger_row_to_api', $reversalRows),
        'balances' => $balances,
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    rewards_json_response(['ok' => false, 'error' => 'reverse_failed', 'details' => $e->getMessage()], 500);
}
