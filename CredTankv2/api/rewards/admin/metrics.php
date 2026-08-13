<?php
declare(strict_types=1);

require_once __DIR__ . '/../init.php';

rewards_require_method('GET');

$date = trim((string) ($_GET['date'] ?? ''));
$metrics = rewards_metrics_snapshot($pdo, $date !== '' ? $date : null);

$earnPoints = (float) ($metrics['earn_points'] ?? 0);
$redeemPoints = (float) ($metrics['redeem_points'] ?? 0);
$earnCashback = (float) ($metrics['earn_cashback_cents'] ?? 0);
$redeemCashback = (float) ($metrics['redeem_cashback_cents'] ?? 0);
$reversalPoints = (float) ($metrics['reversal_points'] ?? 0);
$reversalCashback = (float) ($metrics['reversal_cashback_cents'] ?? 0);

$redemptionRate = $earnPoints > 0 ? ($redeemPoints / $earnPoints) : 0.0;
$reversalRate = $earnPoints > 0 ? ($reversalPoints / $earnPoints) : 0.0;

$activeStmt = $pdo->query(
    "SELECT COUNT(DISTINCT user_id) FROM reward_ledgers WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
);
$activeUsers30d = (int) $activeStmt->fetchColumn();

rewards_json_response([
    'ok' => true,
    'date' => $date !== '' ? $date : (new DateTimeImmutable())->format('Y-m-d'),
    'metrics' => [
        'earn_points' => (int) round($earnPoints),
        'redeem_points' => (int) round($redeemPoints),
        'earn_cashback' => rewards_cents_to_decimal((int) round($earnCashback)),
        'redeem_cashback' => rewards_cents_to_decimal((int) round($redeemCashback)),
        'reversal_points' => (int) round($reversalPoints),
        'reversal_cashback' => rewards_cents_to_decimal((int) round($reversalCashback)),
        'redemption_rate' => round($redemptionRate, 4),
        'reversal_rate' => round($reversalRate, 4),
        'active_users_30d' => $activeUsers30d,
    ],
]);
