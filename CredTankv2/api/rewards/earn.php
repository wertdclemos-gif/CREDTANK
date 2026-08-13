<?php
declare(strict_types=1);

require_once __DIR__ . '/init.php';

rewards_require_method('POST');
$in = rewards_read_json_body();

$userId = trim((string) ($in['user_id'] ?? ''));
$externalTxId = trim((string) ($in['external_transaction_id'] ?? ''));
$merchantId = trim((string) ($in['merchant_id'] ?? ''));

if ($userId === '' || $externalTxId === '') {
    rewards_json_response(['ok' => false, 'error' => 'missing_required_fields'], 422);
}

$baseAmountCents = rewards_money_to_cents($in['base_amount'] ?? '0');
$eligibleAmountCents = rewards_money_to_cents($in['eligible_amount'] ?? $in['base_amount'] ?? '0');
if ($eligibleAmountCents < 0) {
    $eligibleAmountCents = 0;
}

$now = rewards_now();
$paidAt = rewards_parse_datetime($in['paid_at'] ?? $now->format(DATE_ATOM));

$createdBy = trim((string) ($in['created_by'] ?? 'system'));
$source = trim((string) ($in['source'] ?? 'api'));
$metadata = rewards_extract_audit_metadata($in);
$metadata['merchant_id'] = $merchantId;
$metadata['items'] = is_array($in['items'] ?? null) ? $in['items'] : [];

try {
    $pdo->beginTransaction();

    rewards_ensure_user_and_account($pdo, $userId);
    rewards_lock_account($pdo, $userId);

    if (!rewards_user_is_enabled($pdo, $userId)) {
        $pdo->commit();
        rewards_json_response([
            'ok' => true,
            'blocked' => true,
            'reason' => 'user_flag_disabled',
            'preview' => ['points' => 0, 'cashback' => '0.00'],
        ]);
    }

    if (!rewards_merchant_is_enabled($pdo, $merchantId)) {
        $pdo->commit();
        rewards_json_response([
            'ok' => true,
            'blocked' => true,
            'reason' => 'merchant_flag_disabled',
            'preview' => ['points' => 0, 'cashback' => '0.00'],
        ]);
    }

    rewards_assert_rate_limit($pdo, $userId, $merchantId, $rules);

    rewards_release_matured_pending($pdo, $rules, $userId);
    rewards_apply_expirations($pdo, $rules, $userId);

    $existing = rewards_fetch_ledger_by_external($pdo, $userId, $externalTxId, ['EARN_POINTS', 'EARN_CASHBACK']);
    if ($existing) {
        $balance = rewards_recompute_account($pdo, $userId);
        $tier = rewards_sync_user_tier($pdo, $userId, $rules, $now);
        $pdo->commit();

        rewards_json_response([
            'ok' => true,
            'idempotent' => true,
            'tier' => $tier,
            'ledger' => array_map('rewards_ledger_row_to_api', $existing),
            'balance' => [
                'points_available' => $balance['points_available'],
                'points_pending' => $balance['points_pending'],
                'cashback_available' => rewards_cents_to_decimal($balance['cashback_available_cents']),
                'cashback_pending' => rewards_cents_to_decimal($balance['cashback_pending_cents']),
            ],
        ]);
    }

    $tier = rewards_sync_user_tier($pdo, $userId, $rules, $now);
    $todayEarned = rewards_fetch_daily_earn_totals($pdo, $userId, $now);

    $campaigns = rewards_fetch_active_campaigns($pdo, $now, [
        'merchant_id' => $merchantId,
        'tier' => $tier,
        'eligible_cents' => $eligibleAmountCents,
    ]);

    $calc = rewards_calculate_earn(
        $eligibleAmountCents,
        $tier,
        $campaigns,
        $rules,
        $todayEarned['points'],
        $todayEarned['cashback_cents']
    );

    $pendingDays = (int) ($rules['pending_days'] ?? 7);
    $availableAt = $paidAt->modify('+' . $pendingDays . ' days')->format('Y-m-d H:i:s');

    if ($calc['cashback_cents'] > 0) {
        rewards_upsert_ledger($pdo, [
            'id' => rewards_uuid_v4(),
            'event_key' => 'earn:' . $userId . ':' . $externalTxId . ':cashback',
            'user_id' => $userId,
            'external_transaction_id' => $externalTxId,
            'type' => 'EARN_CASHBACK',
            'status' => 'PENDING',
            'amount_points' => 0,
            'amount_cashback_cents' => $calc['cashback_cents'],
            'base_amount_cents' => $baseAmountCents,
            'eligible_amount_cents' => $eligibleAmountCents,
            'available_at' => $availableAt,
            'expires_at' => null,
            'campaign_id' => null,
            'metadata' => array_merge($metadata, [
                'breakdown' => $calc['breakdown'],
            ]),
            'created_by' => $createdBy,
            'source' => $source,
            'created_at' => rewards_to_mysql_datetime($now),
        ]);
        rewards_metric_increment($pdo, 'earn_cashback_cents', (float) $calc['cashback_cents']);
    }

    $ledgerRows = rewards_fetch_ledger_by_external($pdo, $userId, $externalTxId, ['EARN_POINTS', 'EARN_CASHBACK']);
    $balance = rewards_recompute_account($pdo, $userId);

    $pdo->commit();

    rewards_json_response([
        'ok' => true,
        'user_id' => $userId,
        'external_transaction_id' => $externalTxId,
        'tier' => $tier,
        'preview' => [
            'points' => $calc['points'],
            'cashback' => rewards_cents_to_decimal($calc['cashback_cents']),
            'status' => $calc['status'],
            'breakdown' => $calc['breakdown'],
            'pending_available_at' => $availableAt,
        ],
        'ledger' => array_map('rewards_ledger_row_to_api', $ledgerRows),
        'balance' => [
            'points_available' => $balance['points_available'],
            'points_pending' => $balance['points_pending'],
            'cashback_available' => rewards_cents_to_decimal($balance['cashback_available_cents']),
            'cashback_pending' => rewards_cents_to_decimal($balance['cashback_pending_cents']),
        ],
    ]);
} catch (RuntimeException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    $error = $e->getMessage();
    if ($error === 'rate_limit_user' || $error === 'rate_limit_merchant') {
        rewards_json_response(['ok' => false, 'error' => $error], 429);
    }
    rewards_json_response(['ok' => false, 'error' => $error], 422);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    rewards_json_response(['ok' => false, 'error' => 'earn_failed', 'details' => $e->getMessage()], 500);
}
