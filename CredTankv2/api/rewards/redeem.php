<?php
declare(strict_types=1);

require_once __DIR__ . '/init.php';

rewards_require_method('POST');
$in = rewards_read_json_body();

$userId = trim((string) ($in['user_id'] ?? ''));
$externalTxId = trim((string) ($in['external_transaction_id'] ?? ''));
if ($userId === '' || $externalTxId === '') {
    rewards_json_response(['ok' => false, 'error' => 'missing_required_fields'], 422);
}

$purchaseAmountCents = rewards_money_to_cents($in['purchase_amount'] ?? '0');
$requestedPoints = 0;
$requestedCashbackCents = rewards_money_to_cents($in['redeem_cashback'] ?? '0');
$requestedCashbackCents = max(0, $requestedCashbackCents);

$createdBy = trim((string) ($in['created_by'] ?? 'system'));
$source = trim((string) ($in['source'] ?? 'api'));
$metadata = rewards_extract_audit_metadata($in);
$cashbackPaymentMode = rewards_is_truthy($in['cashback_payment'] ?? false)
    || (($metadata['mode'] ?? '') === 'cashback_payment');

try {
    $pdo->beginTransaction();

    rewards_ensure_user_and_account($pdo, $userId);
    rewards_lock_account($pdo, $userId);

    rewards_release_matured_pending($pdo, $rules, $userId);
    rewards_apply_expirations($pdo, $rules, $userId);

    $existing = rewards_fetch_redeem_by_external($pdo, $userId, $externalTxId);
    if ($existing) {
        $balance = rewards_recompute_account($pdo, $userId);
        $pdo->commit();
        rewards_json_response([
            'ok' => true,
            'idempotent' => true,
            'ledger' => array_map('rewards_ledger_row_to_api', $existing),
            'balance' => [
                'points_available' => $balance['points_available'],
                'points_pending' => $balance['points_pending'],
                'cashback_available' => rewards_cents_to_decimal($balance['cashback_available_cents']),
                'cashback_pending' => rewards_cents_to_decimal($balance['cashback_pending_cents']),
            ],
        ]);
    }

    $balance = rewards_recompute_account($pdo, $userId);
    if ($cashbackPaymentMode && $requestedCashbackCents <= 0) {
        $requestedCashbackCents = $purchaseAmountCents;
    }
    $calcOptions = [];
    if ($cashbackPaymentMode) {
        $calcOptions['max_order_ratio_bps'] = 10000;
        $calcOptions['allow_below_minimum'] = true;
    }
    $calc = rewards_calculate_redeem(
        $purchaseAmountCents,
        $requestedPoints,
        $requestedCashbackCents,
        $balance,
        $rules,
        $calcOptions
    );

    if (empty($calc['ok'])) {
        $pdo->commit();
        rewards_json_response([
            'ok' => false,
            'error' => $calc['error'] ?? 'redeem_not_allowed',
            'details' => $calc,
        ], 422);
    }

    $approvedPoints = (int) ($calc['approved_points'] ?? 0);
    $approvedCashbackCents = (int) ($calc['approved_cashback_cents'] ?? 0);

    if ($cashbackPaymentMode && $approvedCashbackCents < $purchaseAmountCents) {
        $pdo->commit();
        rewards_json_response([
            'ok' => false,
            'error' => 'insufficient_cashback_payment_balance',
            'details' => [
                'purchase_amount' => rewards_cents_to_decimal($purchaseAmountCents),
                'approved_cashback' => rewards_cents_to_decimal($approvedCashbackCents),
            ],
        ], 422);
    }

    $created = [];

    if ($approvedCashbackCents > 0) {
        $remaining = $approvedCashbackCents;
        $lots = rewards_fetch_fifo_lots($pdo, $userId, 'EARN_CASHBACK');
        $index = 0;
        foreach ($lots as $lot) {
            if ($remaining <= 0) {
                break;
            }
            $available = (int) ($lot['remaining_cashback_cents'] ?? 0);
            if ($available <= 0) {
                continue;
            }
            $consume = min($available, $remaining);
            $remaining -= $consume;
            $index++;

            rewards_upsert_ledger($pdo, [
                'id' => rewards_uuid_v4(),
                'event_key' => 'redeem:' . $userId . ':' . $externalTxId . ':cashback:' . $index . ':' . $lot['id'],
                'user_id' => $userId,
                'external_transaction_id' => $externalTxId,
                'type' => 'REDEEM_CASHBACK',
                'status' => 'AVAILABLE',
                'amount_points' => 0,
                'amount_cashback_cents' => -$consume,
                'base_amount_cents' => $purchaseAmountCents,
                'eligible_amount_cents' => $purchaseAmountCents,
                'related_ledger_id' => $lot['id'],
                'metadata' => array_merge($metadata, [
                    'consumed_source' => $lot['id'],
                    'consumed_cashback' => rewards_cents_to_decimal($consume),
                ]),
                'created_by' => $createdBy,
                'source' => $source,
            ]);
        }

        if ($remaining > 0) {
            throw new RuntimeException('insufficient_cashback_fifo');
        }

        rewards_metric_increment($pdo, 'redeem_cashback_cents', (float) $approvedCashbackCents);
    }

    $created = rewards_fetch_redeem_by_external($pdo, $userId, $externalTxId);
    $updatedBalance = rewards_recompute_account($pdo, $userId);

    $pdo->commit();

    rewards_json_response([
        'ok' => true,
        'user_id' => $userId,
        'external_transaction_id' => $externalTxId,
        'approved' => [
            'points' => $approvedPoints,
            'cashback' => rewards_cents_to_decimal($approvedCashbackCents),
            'total_value' => rewards_cents_to_decimal($approvedPoints + $approvedCashbackCents),
        ],
        'ledger' => array_map('rewards_ledger_row_to_api', $created),
        'balance' => [
            'points_available' => $updatedBalance['points_available'],
            'points_pending' => $updatedBalance['points_pending'],
            'cashback_available' => rewards_cents_to_decimal($updatedBalance['cashback_available_cents']),
            'cashback_pending' => rewards_cents_to_decimal($updatedBalance['cashback_pending_cents']),
        ],
    ]);
} catch (RuntimeException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    rewards_json_response([
        'ok' => false,
        'error' => $e->getMessage(),
    ], 422);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    rewards_json_response(['ok' => false, 'error' => 'redeem_failed', 'details' => $e->getMessage()], 500);
}
