<?php
declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/config.php';

function rewards_determine_tier(int $spend30dCents, array $rules): string
{
    $tiers = $rules['tiers'] ?? [];
    foreach ($tiers as $name => $tierRule) {
        $min = (int) ($tierRule['min_cents'] ?? 0);
        $max = $tierRule['max_cents'];
        if ($spend30dCents < $min) {
            continue;
        }
        if ($max !== null && $spend30dCents > (int) $max) {
            continue;
        }
        return $name;
    }
    return 'bronze';
}

function rewards_tier_rule(string $tier, array $rules): array
{
    $tiers = $rules['tiers'] ?? [];
    if (isset($tiers[$tier]) && is_array($tiers[$tier])) {
        return $tiers[$tier];
    }
    return $tiers['bronze'] ?? [
        'points_x10000' => 10000,
        'cashback_bonus_bps' => 0,
    ];
}

function rewards_parse_multiplier_x10000($value): int
{
    if ($value === null || $value === '') {
        return 10000;
    }
    if (is_numeric($value)) {
        return max(0, (int) round((float) $value * 10000));
    }
    return 10000;
}

function rewards_parse_pp_to_bps($value): int
{
    if ($value === null || $value === '') {
        return 0;
    }
    if (is_numeric($value)) {
        return (int) round((float) $value * 100);
    }
    return 0;
}

function rewards_select_campaigns(array $campaigns): array
{
    if (!$campaigns) {
        return [];
    }

    $stackable = [];
    $nonStackable = [];

    foreach ($campaigns as $campaign) {
        if (!is_array($campaign)) {
            continue;
        }
        if (!empty($campaign['stackable'])) {
            $stackable[] = $campaign;
        } else {
            $nonStackable[] = $campaign;
        }
    }

    if (!$nonStackable) {
        return $stackable;
    }

    usort($nonStackable, static function (array $a, array $b): int {
        $scoreA = rewards_parse_multiplier_x10000($a['points_multiplier'] ?? 1) - 10000
            + rewards_parse_pp_to_bps($a['cashback_bonus_pp'] ?? 0) * 10;
        $scoreB = rewards_parse_multiplier_x10000($b['points_multiplier'] ?? 1) - 10000
            + rewards_parse_pp_to_bps($b['cashback_bonus_pp'] ?? 0) * 10;
        return $scoreB <=> $scoreA;
    });

    $selected = $stackable;
    $selected[] = $nonStackable[0];
    return $selected;
}

function rewards_calculate_earn(
    int $eligibleCents,
    string $tier,
    array $campaigns,
    array $rules,
    int $earnedTodayPoints,
    int $earnedTodayCashbackCents
): array {
    $minEligible = (int) ($rules['min_eligible_cents'] ?? 0);
    if ($eligibleCents < $minEligible) {
        return [
            'points' => 0,
            'cashback_cents' => 0,
            'status' => 'ineligible_min_amount',
            'breakdown' => [
                'min_eligible_cents' => $minEligible,
                'eligible_cents' => $eligibleCents,
                'applied_campaigns' => [],
            ],
        ];
    }

    $tierRule = rewards_tier_rule($tier, $rules);
    $selectedCampaigns = rewards_select_campaigns($campaigns);

    $cashbackBps = (int) ($rules['cashback_base_bps'] ?? 0) + (int) ($tierRule['cashback_bonus_bps'] ?? 0);

    foreach ($selectedCampaigns as $campaign) {
        $cashbackBps += rewards_parse_pp_to_bps($campaign['cashback_bonus_pp'] ?? 0);
    }

    $maxCashbackBps = (int) ($rules['campaign']['cashback_rate_cap_bps'] ?? 300);
    if ($cashbackBps > $maxCashbackBps) {
        $cashbackBps = $maxCashbackBps;
    }

    $points = 0;

    $cashbackCents = rewards_round_div_even($eligibleCents * $cashbackBps, 10000);

    $txCapCashback = (int) ($rules['tx_caps']['cashback_cents'] ?? PHP_INT_MAX);
    $cashbackCents = max(0, min($cashbackCents, $txCapCashback));

    $dailyCapCashback = (int) ($rules['daily_caps']['cashback_cents'] ?? PHP_INT_MAX);
    $remainingCashback = max(0, $dailyCapCashback - $earnedTodayCashbackCents);

    $cashbackCents = min($cashbackCents, $remainingCashback);

    return [
        'points' => $points,
        'cashback_cents' => $cashbackCents,
        'status' => $cashbackCents === 0 ? 'capped' : 'ok',
        'breakdown' => [
            'tier' => $tier,
            'cashback_rate_bps' => $cashbackBps,
            'points_enabled' => false,
            'earned_today_cashback_cents' => $earnedTodayCashbackCents,
            'applied_campaigns' => array_map(
                static fn(array $campaign): array => [
                    'id' => $campaign['id'] ?? null,
                    'name' => $campaign['name'] ?? null,
                    'stackable' => !empty($campaign['stackable']),
                ],
                $selectedCampaigns
            ),
        ],
    ];
}

function rewards_calculate_redeem(
    int $purchaseAmountCents,
    int $requestedPoints,
    int $requestedCashbackCents,
    array $balances,
    array $rules,
    array $options = []
): array {
    if ($purchaseAmountCents <= 0) {
        return [
            'ok' => false,
            'error' => 'invalid_purchase_amount',
        ];
    }

    $availableCashback = (int) ($balances['cashback_available_cents'] ?? 0);

    if (!empty($rules['redeem']['block_if_negative']) && $availableCashback < 0) {
        return [
            'ok' => false,
            'error' => 'negative_balance_blocked',
        ];
    }

    $requestedPoints = 0;
    $requestedCashbackCents = max(0, $requestedCashbackCents);

    $maxOrderRatioBps = isset($options['max_order_ratio_bps'])
        ? (int) $options['max_order_ratio_bps']
        : (int) ($rules['redeem']['max_order_ratio_bps'] ?? 3000);
    $maxOrderRatioBps = max(0, min(10000, $maxOrderRatioBps));
    $maxOrderCents = intdiv($purchaseAmountCents * $maxOrderRatioBps, 10000);

    $approvedPoints = 0;
    $approvedCashbackCents = min($requestedCashbackCents, max(0, $availableCashback), $maxOrderCents);

    $approvedTotalCents = $approvedCashbackCents;
    $minRedeemCents = (int) ($rules['redeem']['min_cents'] ?? 0);
    $allowBelowMinimum = !empty($options['allow_below_minimum']);

    if (!$allowBelowMinimum && $approvedTotalCents < $minRedeemCents) {
        return [
            'ok' => false,
            'error' => 'redeem_below_minimum',
            'approved_points' => $approvedPoints,
            'approved_cashback_cents' => $approvedCashbackCents,
            'max_order_cents' => $maxOrderCents,
        ];
    }

    return [
        'ok' => true,
        'approved_points' => $approvedPoints,
        'approved_cashback_cents' => $approvedCashbackCents,
        'approved_total_cents' => $approvedTotalCents,
        'max_order_cents' => $maxOrderCents,
    ];
}

function rewards_compute_expiration_schedule(string $type, DateTimeImmutable $availableAt, array $rules): ?string
{
    $enabled = !array_key_exists('enabled', $rules['expiration'] ?? []) || !empty($rules['expiration']['enabled']);
    if (!$enabled) {
        return null;
    }

    if ($type === 'EARN_POINTS') {
        $months = $rules['expiration']['points_months'] ?? 12;
        return rewards_months_after($availableAt, is_numeric($months) ? (int) $months : null);
    }

    if ($type === 'EARN_CASHBACK') {
        $months = $rules['expiration']['cashback_months'] ?? 6;
        return rewards_months_after($availableAt, is_numeric($months) ? (int) $months : null);
    }

    return null;
}
