<?php
declare(strict_types=1);

require_once __DIR__ . '/../common.php';
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../engine.php';

$rules = rewards_default_rules();
$failures = [];

$assert = static function (bool $cond, string $message) use (&$failures): void {
    if (!$cond) {
        $failures[] = $message;
    }
};

$assert(rewards_round_div_even(5, 2) === 2, 'bankers rounding 2.5 should round to 2');
$assert(rewards_round_div_even(7, 2) === 4, 'bankers rounding 3.5 should round to 4');
$assert(rewards_money_to_cents('10,01') === 1001, 'money parser should parse pt-BR strings');

$earnLow = rewards_calculate_earn(400, 'bronze', [], $rules, 0, 0);
$assert($earnLow['points'] === 0 && $earnLow['cashback_cents'] === 0, 'transactions below R$5 should not earn');

$earnNormal = rewards_calculate_earn(10000, 'bronze', [], $rules, 0, 0);
$assert($earnNormal['points'] === 100, 'R$100 should generate 100 points in bronze');
$assert($earnNormal['cashback_cents'] === 150, 'R$100 should generate R$1.50 cashback in bronze');

$earnCapped = rewards_calculate_earn(10000000, 'ouro', [], $rules, 0, 0);
$assert($earnCapped['points'] <= 10000, 'per transaction points cap should apply');
$assert($earnCapped['cashback_cents'] <= 8000, 'per transaction cashback cap should apply');

$earnDailyCap = rewards_calculate_earn(100000, 'bronze', [], $rules, 4900, 4900);
$assert($earnDailyCap['points'] <= 100, 'daily points cap remainder should apply');
$assert($earnDailyCap['cashback_cents'] <= 100, 'daily cashback cap remainder should apply');

$campaigns = [
    ['id' => 'A', 'stackable' => true, 'points_multiplier' => 1.2, 'cashback_bonus_pp' => 0.2],
    ['id' => 'B', 'stackable' => false, 'points_multiplier' => 1.3, 'cashback_bonus_pp' => 0.4],
    ['id' => 'C', 'stackable' => false, 'points_multiplier' => 1.1, 'cashback_bonus_pp' => 0.1],
];
$selected = rewards_select_campaigns($campaigns);
$ids = array_map(static fn(array $c): string => (string) $c['id'], $selected);
$assert(in_array('A', $ids, true), 'stackable campaign should be selected');
$assert(in_array('B', $ids, true), 'best non-stackable campaign should be selected');
$assert(!in_array('C', $ids, true), 'lower non-stackable campaign should be ignored');

$redeem = rewards_calculate_redeem(10000, 500, 1000, [
    'points_available' => 1000,
    'cashback_available_cents' => 1000,
], $rules);
$assert(!empty($redeem['ok']), 'valid redeem should pass');
$assert($redeem['approved_points'] + $redeem['approved_cashback_cents'] <= 3000, 'redeem should not exceed 30%');

$redeemMin = rewards_calculate_redeem(10000, 100, 100, [
    'points_available' => 1000,
    'cashback_available_cents' => 1000,
], $rules);
$assert(empty($redeemMin['ok']) && $redeemMin['error'] === 'redeem_below_minimum', 'redeem minimum R$5 should be enforced');

$redeemNegative = rewards_calculate_redeem(10000, 500, 500, [
    'points_available' => -10,
    'cashback_available_cents' => 0,
], $rules);
$assert(empty($redeemNegative['ok']) && $redeemNegative['error'] === 'negative_balance_blocked', 'negative balance should block redeem');

$expPoints = rewards_compute_expiration_schedule('EARN_POINTS', new DateTimeImmutable('2026-01-01 10:00:00'), $rules);
$assert(str_starts_with((string) $expPoints, '2027-01-01'), 'points should expire in 12 months');
$expCashback = rewards_compute_expiration_schedule('EARN_CASHBACK', new DateTimeImmutable('2026-01-01 10:00:00'), $rules);
$assert(str_starts_with((string) $expCashback, '2026-07-01'), 'cashback should expire in 6 months');

$repoSource = file_get_contents(__DIR__ . '/../repository.php') ?: '';
$assert(str_contains($repoSource, 'FOR UPDATE'), 'concurrency lock (FOR UPDATE) must exist to avoid balance races');

$migrationSource = file_get_contents(__DIR__ . '/../migrations/001_rewards.sql') ?: '';
$assert(str_contains($migrationSource, 'UNIQUE KEY (event_key)'), 'idempotency unique event key must exist');

if ($failures) {
    fwrite(STDERR, "FAILED TESTS:\n- " . implode("\n- ", $failures) . "\n");
    exit(1);
}

echo "All rewards tests passed\n";
