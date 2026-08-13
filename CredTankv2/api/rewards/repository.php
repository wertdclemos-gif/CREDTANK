<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/common.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/engine.php';

function rewards_recursive_merge(array $base, array $override): array
{
    foreach ($override as $key => $value) {
        if (is_array($value) && isset($base[$key]) && is_array($base[$key])) {
            $base[$key] = rewards_recursive_merge($base[$key], $value);
            continue;
        }
        $base[$key] = $value;
    }
    return $base;
}

function rewards_load_rules(PDO $pdo): array
{
    $defaults = rewards_default_rules();

    $stmt = $pdo->prepare('SELECT setting_value FROM reward_settings WHERE setting_key = ? LIMIT 1');
    $stmt->execute(['rules_json']);
    $raw = $stmt->fetchColumn();

    if (!is_string($raw) || trim($raw) === '') {
        return $defaults;
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return $defaults;
    }

    return rewards_recursive_merge($defaults, $decoded);
}

function rewards_seed_default_settings(PDO $pdo): void
{
    $defaults = rewards_default_rules();
    $payload = json_encode($defaults, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($payload === false) {
        return;
    }
    $stmt = $pdo->prepare(
        'INSERT INTO reward_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = setting_value'
    );
    $stmt->execute(['rules_json', $payload]);
}

function rewards_ensure_user_and_account(PDO $pdo, string $userId): void
{
    $insertUser = $pdo->prepare(
        "INSERT INTO rewards_users (id, tier, status) VALUES (?, 'bronze', 'active') ON DUPLICATE KEY UPDATE id = VALUES(id)"
    );
    $insertUser->execute([$userId]);

    $insertAccount = $pdo->prepare(
        "INSERT INTO reward_accounts (user_id, points_available, points_pending, cashback_available, cashback_pending)
         VALUES (?, 0, 0, 0.00, 0.00)
         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)"
    );
    $insertAccount->execute([$userId]);
}

function rewards_lock_account(PDO $pdo, string $userId): void
{
    $stmt = $pdo->prepare('SELECT user_id FROM reward_accounts WHERE user_id = ? FOR UPDATE');
    $stmt->execute([$userId]);
    if (!$stmt->fetchColumn()) {
        rewards_ensure_user_and_account($pdo, $userId);
        $stmt->execute([$userId]);
    }
}

function rewards_get_user_status(PDO $pdo, string $userId): array
{
    $stmt = $pdo->prepare('SELECT tier, status FROM rewards_users WHERE id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return [
        'tier' => $row['tier'] ?? 'bronze',
        'status' => $row['status'] ?? 'active',
    ];
}

function rewards_user_is_enabled(PDO $pdo, string $userId): bool
{
    $stmt = $pdo->prepare('SELECT rewards_enabled FROM reward_user_flags WHERE user_id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $value = $stmt->fetchColumn();
    if ($value === false || $value === null) {
        return true;
    }
    return (int) $value === 1;
}

function rewards_merchant_is_enabled(PDO $pdo, string $merchantId): bool
{
    if ($merchantId === '') {
        return true;
    }
    $stmt = $pdo->prepare('SELECT rewards_enabled FROM reward_merchant_flags WHERE merchant_id = ? LIMIT 1');
    $stmt->execute([$merchantId]);
    $value = $stmt->fetchColumn();
    if ($value === false || $value === null) {
        return true;
    }
    return (int) $value === 1;
}

function rewards_upsert_ledger(PDO $pdo, array $entry): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO reward_ledgers (
            id, event_key, user_id, external_transaction_id, type, status, amount_points, amount_cashback,
            base_amount, eligible_amount, campaign_id, available_at, expires_at, related_ledger_id,
            metadata, created_by, source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE id = id'
    );

    $stmt->execute([
        $entry['id'],
        $entry['event_key'],
        $entry['user_id'],
        $entry['external_transaction_id'],
        $entry['type'],
        $entry['status'],
        (int) ($entry['amount_points'] ?? 0),
        rewards_cents_to_decimal((int) ($entry['amount_cashback_cents'] ?? 0)),
        array_key_exists('base_amount_cents', $entry) ? rewards_cents_to_decimal((int) $entry['base_amount_cents']) : null,
        array_key_exists('eligible_amount_cents', $entry) ? rewards_cents_to_decimal((int) $entry['eligible_amount_cents']) : null,
        $entry['campaign_id'] ?? null,
        $entry['available_at'] ?? null,
        $entry['expires_at'] ?? null,
        $entry['related_ledger_id'] ?? null,
        json_encode($entry['metadata'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        $entry['created_by'] ?? null,
        $entry['source'] ?? null,
        $entry['created_at'] ?? rewards_to_mysql_datetime('now'),
    ]);
}

function rewards_fetch_ledger_by_external(PDO $pdo, string $userId, string $externalTxId, array $types): array
{
    if (!$types) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($types), '?'));
    $sql = "SELECT * FROM reward_ledgers WHERE user_id = ? AND external_transaction_id = ? AND type IN ($placeholders) ORDER BY created_at ASC";
    $stmt = $pdo->prepare($sql);
    $params = array_merge([$userId, $externalTxId], $types);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function rewards_fetch_earn_rows_by_external(PDO $pdo, string $externalTxId): array
{
    $stmt = $pdo->prepare(
        "SELECT * FROM reward_ledgers
         WHERE external_transaction_id = ?
           AND type IN ('EARN_POINTS', 'EARN_CASHBACK')
         ORDER BY created_at ASC"
    );
    $stmt->execute([$externalTxId]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function rewards_fetch_daily_earn_totals(PDO $pdo, string $userId, DateTimeImmutable $reference): array
{
    $dateStart = $reference->format('Y-m-d 00:00:00');
    $dateEnd = $reference->format('Y-m-d 23:59:59');

    $stmt = $pdo->prepare(
        "SELECT
            COALESCE(SUM(CASE WHEN type = 'EARN_POINTS' THEN amount_points ELSE 0 END), 0) AS points,
            COALESCE(SUM(CASE WHEN type = 'EARN_CASHBACK' THEN amount_cashback ELSE 0 END), 0) AS cashback
         FROM reward_ledgers
         WHERE user_id = ?
           AND type IN ('EARN_POINTS', 'EARN_CASHBACK')
           AND status IN ('PENDING', 'AVAILABLE')
           AND created_at BETWEEN ? AND ?"
    );
    $stmt->execute([$userId, $dateStart, $dateEnd]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    return [
        'points' => (int) ($row['points'] ?? 0),
        'cashback_cents' => rewards_money_to_cents($row['cashback'] ?? '0'),
    ];
}

function rewards_compute_30d_spend_cents(PDO $pdo, string $userId, DateTimeImmutable $reference): int
{
    $from = $reference->modify('-30 days')->format('Y-m-d H:i:s');
    $to = $reference->format('Y-m-d H:i:s');

    $stmt = $pdo->prepare(
        "SELECT COALESCE(SUM(base_amount), 0) AS total
         FROM (
           SELECT external_transaction_id, MAX(base_amount) AS base_amount
           FROM reward_ledgers
           WHERE user_id = ?
             AND type IN ('EARN_POINTS', 'EARN_CASHBACK')
             AND status = 'AVAILABLE'
             AND created_at BETWEEN ? AND ?
           GROUP BY external_transaction_id
         ) t"
    );
    $stmt->execute([$userId, $from, $to]);
    $total = $stmt->fetchColumn();
    return rewards_money_to_cents((string) $total);
}

function rewards_sync_user_tier(PDO $pdo, string $userId, array $rules, DateTimeImmutable $reference): string
{
    $spendCents = rewards_compute_30d_spend_cents($pdo, $userId, $reference);
    $tier = rewards_determine_tier($spendCents, $rules);

    $stmt = $pdo->prepare('UPDATE rewards_users SET tier = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    $stmt->execute([$tier, $userId]);

    return $tier;
}

function rewards_fetch_active_campaigns(PDO $pdo, DateTimeImmutable $reference, array $context): array
{
    $now = $reference->format('Y-m-d H:i:s');
    $stmt = $pdo->prepare(
        "SELECT * FROM reward_campaigns
         WHERE status = 'active'
           AND start_at <= ?
           AND end_at >= ?"
    );
    $stmt->execute([$now, $now]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $eligible = [];
    foreach ($rows as $row) {
        $rules = json_decode((string) ($row['eligibility_rules_json'] ?? ''), true);
        if (!is_array($rules)) {
            $rules = [];
        }

        $merchantAllow = true;
        if (!empty($rules['merchant_ids']) && is_array($rules['merchant_ids'])) {
            $merchantAllow = in_array((string) ($context['merchant_id'] ?? ''), $rules['merchant_ids'], true);
        }

        $tierAllow = true;
        if (!empty($rules['tiers']) && is_array($rules['tiers'])) {
            $tierAllow = in_array((string) ($context['tier'] ?? 'bronze'), $rules['tiers'], true);
        }

        $minAllow = true;
        if (isset($rules['min_value_cents'])) {
            $minAllow = (int) ($context['eligible_cents'] ?? 0) >= (int) $rules['min_value_cents'];
        }

        if (!$merchantAllow || !$tierAllow || !$minAllow) {
            continue;
        }

        $row['stackable'] = (int) ($row['stackable'] ?? 0) === 1;
        $eligible[] = $row;
    }

    return $eligible;
}

function rewards_release_matured_pending(PDO $pdo, array $rules, ?string $userId = null): int
{
    $sql = "SELECT id, type, available_at FROM reward_ledgers WHERE status = 'PENDING' AND type IN ('EARN_POINTS', 'EARN_CASHBACK') AND available_at IS NOT NULL AND available_at <= NOW()";
    $params = [];
    if ($userId !== null) {
        $sql .= ' AND user_id = ?';
        $params[] = $userId;
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    if (!$rows) {
        return 0;
    }

    $updated = 0;
    $update = $pdo->prepare('UPDATE reward_ledgers SET status = ?, expires_at = ? WHERE id = ?');
    foreach ($rows as $row) {
        $availableAt = rewards_parse_datetime($row['available_at'] ?? null);
        $expiresAt = rewards_compute_expiration_schedule((string) $row['type'], $availableAt, $rules);
        $update->execute(['AVAILABLE', $expiresAt, $row['id']]);
        $updated++;
    }

    return $updated;
}

function rewards_fetch_fifo_lots(PDO $pdo, string $userId, string $earnType): array
{
    $stmt = $pdo->prepare(
        "SELECT
            e.id,
            e.type,
            e.amount_points,
            e.amount_cashback,
            e.expires_at,
            e.created_at,
            COALESCE(SUM(c.amount_points), 0) AS consumed_points,
            COALESCE(SUM(c.amount_cashback), 0) AS consumed_cashback
         FROM reward_ledgers e
         LEFT JOIN reward_ledgers c
           ON c.related_ledger_id = e.id
          AND c.status = 'AVAILABLE'
         WHERE e.user_id = ?
           AND e.status = 'AVAILABLE'
           AND e.type = ?
         GROUP BY e.id, e.type, e.amount_points, e.amount_cashback, e.expires_at, e.created_at
         ORDER BY (e.expires_at IS NULL) ASC, e.expires_at ASC, e.created_at ASC"
    );
    $stmt->execute([$userId, $earnType]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $lots = [];
    foreach ($rows as $row) {
        if ($earnType === 'EARN_POINTS') {
            $remaining = (int) $row['amount_points'] + (int) $row['consumed_points'];
            if ($remaining <= 0) {
                continue;
            }
            $row['remaining_points'] = $remaining;
        } else {
            $remainingCents = rewards_money_to_cents((string) $row['amount_cashback']) + rewards_money_to_cents((string) $row['consumed_cashback']);
            if ($remainingCents <= 0) {
                continue;
            }
            $row['remaining_cashback_cents'] = $remainingCents;
        }
        $lots[] = $row;
    }

    return $lots;
}

function rewards_apply_expirations(PDO $pdo, array $rules, ?string $userId = null): int
{
    $enabled = !array_key_exists('enabled', $rules['expiration'] ?? []) || !empty($rules['expiration']['enabled']);
    if (!$enabled) {
        return 0;
    }

    $expired = 0;

    $types = ['EARN_POINTS', 'EARN_CASHBACK'];
    foreach ($types as $type) {
        $lots = $userId !== null ? rewards_fetch_fifo_lots($pdo, $userId, $type) : [];
        if ($userId === null) {
            $stmt = $pdo->prepare("SELECT DISTINCT user_id FROM reward_ledgers WHERE type = ? AND status = 'AVAILABLE' AND expires_at IS NOT NULL AND expires_at <= NOW()");
            $stmt->execute([$type]);
            $users = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
            foreach ($users as $uid) {
                $lots = array_merge($lots, rewards_fetch_fifo_lots($pdo, (string) $uid, $type));
            }
        }

        foreach ($lots as $lot) {
            $expiresAt = $lot['expires_at'] ?? null;
            if (!$expiresAt) {
                continue;
            }
            if (rewards_parse_datetime($expiresAt) > rewards_now()) {
                continue;
            }

            $amountPoints = 0;
            $amountCashbackCents = 0;
            $eventType = 'EXPIRE_POINTS';
            if ($type === 'EARN_POINTS') {
                $remaining = (int) ($lot['remaining_points'] ?? 0);
                if ($remaining <= 0) {
                    continue;
                }
                $amountPoints = -$remaining;
            } else {
                $remainingCents = (int) ($lot['remaining_cashback_cents'] ?? 0);
                if ($remainingCents <= 0) {
                    continue;
                }
                $amountCashbackCents = -$remainingCents;
                $eventType = 'EXPIRE_CASHBACK';
            }

            $eventKey = 'expire:' . $lot['id'] . ':' . substr((string) $expiresAt, 0, 10);
            rewards_upsert_ledger($pdo, [
                'id' => rewards_uuid_v4(),
                'event_key' => $eventKey,
                'user_id' => $lot['user_id'],
                'external_transaction_id' => 'EXP-' . $lot['id'],
                'type' => $eventType,
                'status' => 'AVAILABLE',
                'amount_points' => $amountPoints,
                'amount_cashback_cents' => $amountCashbackCents,
                'related_ledger_id' => $lot['id'],
                'metadata' => [
                    'reason' => 'expiration',
                    'source_lot' => $lot['id'],
                ],
                'source' => 'rewards-cron',
                'created_by' => 'system',
            ]);
            $expired++;
        }
    }

    return $expired;
}

function rewards_recompute_account(PDO $pdo, string $userId): array
{
    $stmt = $pdo->prepare(
        "SELECT
            COALESCE(SUM(CASE WHEN status = 'AVAILABLE' THEN amount_points ELSE 0 END), 0) AS points_available,
            COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount_points ELSE 0 END), 0) AS points_pending,
            COALESCE(SUM(CASE WHEN status = 'AVAILABLE' THEN amount_cashback ELSE 0 END), 0) AS cashback_available,
            COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount_cashback ELSE 0 END), 0) AS cashback_pending
         FROM reward_ledgers
         WHERE user_id = ?"
    );
    $stmt->execute([$userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $pointsAvailable = (int) ($row['points_available'] ?? 0);
    $pointsPending = (int) ($row['points_pending'] ?? 0);
    $cashbackAvailableCents = rewards_money_to_cents((string) ($row['cashback_available'] ?? '0'));
    $cashbackPendingCents = rewards_money_to_cents((string) ($row['cashback_pending'] ?? '0'));

    $update = $pdo->prepare(
        "UPDATE reward_accounts
         SET points_available = ?,
             points_pending = ?,
             cashback_available = ?,
             cashback_pending = ?,
             version = version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?"
    );
    $update->execute([
        $pointsAvailable,
        $pointsPending,
        rewards_cents_to_decimal($cashbackAvailableCents),
        rewards_cents_to_decimal($cashbackPendingCents),
        $userId,
    ]);

    return [
        'points_available' => $pointsAvailable,
        'points_pending' => $pointsPending,
        'cashback_available_cents' => $cashbackAvailableCents,
        'cashback_pending_cents' => $cashbackPendingCents,
    ];
}

function rewards_get_expiring_soon(PDO $pdo, string $userId): array
{
    $limitDate = rewards_now()->modify('+30 days');

    $pointLots = rewards_fetch_fifo_lots($pdo, $userId, 'EARN_POINTS');
    $cashbackLots = rewards_fetch_fifo_lots($pdo, $userId, 'EARN_CASHBACK');

    $points = 0;
    $cashbackCents = 0;

    foreach ($pointLots as $lot) {
        if (empty($lot['expires_at'])) {
            continue;
        }
        $expiresAt = rewards_parse_datetime($lot['expires_at']);
        if ($expiresAt > $limitDate) {
            continue;
        }
        $points += (int) ($lot['remaining_points'] ?? 0);
    }

    foreach ($cashbackLots as $lot) {
        if (empty($lot['expires_at'])) {
            continue;
        }
        $expiresAt = rewards_parse_datetime($lot['expires_at']);
        if ($expiresAt > $limitDate) {
            continue;
        }
        $cashbackCents += (int) ($lot['remaining_cashback_cents'] ?? 0);
    }

    return [
        'points' => $points,
        'cashback_cents' => $cashbackCents,
    ];
}

function rewards_assert_rate_limit(PDO $pdo, string $userId, string $merchantId, array $rules): void
{
    $limits = $rules['rate_limit'] ?? [];
    $maxUser = (int) ($limits['max_earn_per_minute_user'] ?? 20);
    $maxMerchant = (int) ($limits['max_earn_per_minute_merchant'] ?? 300);

    $stmtUser = $pdo->prepare(
        "SELECT COUNT(*) FROM reward_ledgers
         WHERE user_id = ?
           AND type IN ('EARN_POINTS', 'EARN_CASHBACK')
           AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)"
    );
    $stmtUser->execute([$userId]);
    $countUser = (int) $stmtUser->fetchColumn();
    if ($countUser >= $maxUser) {
        throw new RuntimeException('rate_limit_user');
    }

    if ($merchantId !== '') {
        $stmtMerchant = $pdo->prepare(
            "SELECT COUNT(*) FROM reward_ledgers
             WHERE type IN ('EARN_POINTS', 'EARN_CASHBACK')
               AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
               AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.merchant_id')) = ?"
        );
        $stmtMerchant->execute([$merchantId]);
        $countMerchant = (int) $stmtMerchant->fetchColumn();
        if ($countMerchant >= $maxMerchant) {
            throw new RuntimeException('rate_limit_merchant');
        }
    }
}

function rewards_metric_increment(PDO $pdo, string $key, float $value): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO reward_metrics_daily (metric_date, metric_key, metric_value)
         VALUES (CURRENT_DATE(), ?, ?)
         ON DUPLICATE KEY UPDATE metric_value = metric_value + VALUES(metric_value)'
    );
    $stmt->execute([$key, $value]);
}

function rewards_metrics_snapshot(PDO $pdo, ?string $date = null): array
{
    $targetDate = $date && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) ? $date : (new DateTimeImmutable())->format('Y-m-d');
    $stmt = $pdo->prepare('SELECT metric_key, metric_value FROM reward_metrics_daily WHERE metric_date = ?');
    $stmt->execute([$targetDate]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $out = [];
    foreach ($rows as $row) {
        $out[$row['metric_key']] = (float) $row['metric_value'];
    }
    return $out;
}

function rewards_ledger_row_to_api(array $row): array
{
    $metadata = json_decode((string) ($row['metadata'] ?? ''), true);
    if (!is_array($metadata)) {
        $metadata = [];
    }

    return [
        'id' => $row['id'] ?? '',
        'user_id' => $row['user_id'] ?? '',
        'external_transaction_id' => $row['external_transaction_id'] ?? '',
        'type' => $row['type'] ?? '',
        'status' => $row['status'] ?? '',
        'amount_points' => (int) ($row['amount_points'] ?? 0),
        'amount_cashback' => rewards_decimal_from_db($row['amount_cashback'] ?? '0'),
        'base_amount' => rewards_decimal_from_db($row['base_amount'] ?? '0'),
        'eligible_amount' => rewards_decimal_from_db($row['eligible_amount'] ?? '0'),
        'campaign_id' => $row['campaign_id'] ?? null,
        'available_at' => $row['available_at'] ?? null,
        'expires_at' => $row['expires_at'] ?? null,
        'related_ledger_id' => $row['related_ledger_id'] ?? null,
        'metadata' => $metadata,
        'created_by' => $row['created_by'] ?? null,
        'source' => $row['source'] ?? null,
        'created_at' => $row['created_at'] ?? null,
    ];
}

function rewards_fetch_redeem_by_external(PDO $pdo, string $userId, string $externalTxId): array
{
    return rewards_fetch_ledger_by_external($pdo, $userId, $externalTxId, ['REDEEM_POINTS', 'REDEEM_CASHBACK']);
}

function rewards_fetch_reversal_by_original_external(PDO $pdo, string $externalTxId): array
{
    $stmt = $pdo->prepare(
        "SELECT * FROM reward_ledgers
         WHERE type = 'REVERSAL'
           AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.original_external_transaction_id')) = ?
         ORDER BY created_at ASC"
    );
    $stmt->execute([$externalTxId]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}
