<?php
declare(strict_types=1);

function rewards_default_rules(): array
{
    return [
        'currency' => 'BRL',
        'cashback_base_bps' => 150,
        'points_per_real' => 1.0,
        'points_to_real' => 100,
        'pending_days' => 7,
        'min_eligible_cents' => 500,
        'daily_caps' => [
            'cashback_cents' => 5000,
            'points' => 5000,
        ],
        'tx_caps' => [
            'cashback_cents' => 8000,
            'points' => 10000,
        ],
        'redeem' => [
            'min_cents' => 500,
            'max_order_ratio_bps' => 3000,
            'block_if_negative' => true,
            'allow_negative_limit' => [
                'points' => -5000,
                'cashback_cents' => -2000,
            ],
        ],
        'expiration' => [
            'points_months' => 12,
            'cashback_months' => 6,
            'enabled' => true,
        ],
        'tiers' => [
            'bronze' => [
                'min_cents' => 0,
                'max_cents' => 49999,
                'points_x10000' => 10000,
                'cashback_bonus_bps' => 0,
            ],
            'prata' => [
                'min_cents' => 50000,
                'max_cents' => 149999,
                'points_x10000' => 11000,
                'cashback_bonus_bps' => 0,
            ],
            'ouro' => [
                'min_cents' => 150000,
                'max_cents' => null,
                'points_x10000' => 12500,
                'cashback_bonus_bps' => 25,
            ],
        ],
        'campaign' => [
            'global_multiplier_cap_x10000' => 20000,
            'cashback_rate_cap_bps' => 300,
        ],
        'rate_limit' => [
            'max_earn_per_minute_user' => 20,
            'max_earn_per_minute_merchant' => 300,
        ],
    ];
}

function rewards_type_constants(): array
{
    return [
        'EARN_POINTS',
        'EARN_CASHBACK',
        'REDEEM_POINTS',
        'REDEEM_CASHBACK',
        'EXPIRE_POINTS',
        'EXPIRE_CASHBACK',
        'REVERSAL',
        'ADJUSTMENT',
    ];
}

function rewards_status_constants(): array
{
    return ['PENDING', 'AVAILABLE', 'CANCELED'];
}
