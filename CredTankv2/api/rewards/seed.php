<?php
declare(strict_types=1);

require_once __DIR__ . '/init.php';

rewards_require_method('POST');

$now = rewards_now();
$start = $now->modify('-1 day')->format('Y-m-d H:i:s');
$end = $now->modify('+90 days')->format('Y-m-d H:i:s');

$campaigns = [
    [
        'id' => 'CAMP-WELCOME-10P',
        'name' => 'Boas-vindas 10% pontos',
        'points_multiplier' => '1.1000',
        'cashback_bonus_pp' => '0.0000',
        'stackable' => 1,
        'eligibility_rules_json' => json_encode(['min_value_cents' => 1000], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ],
    [
        'id' => 'CAMP-POSTO-PLUS',
        'name' => 'Parceiro Posto Plus',
        'points_multiplier' => '1.0000',
        'cashback_bonus_pp' => '0.2500',
        'stackable' => 0,
        'eligibility_rules_json' => json_encode(['merchant_ids' => ['P-LOCAL', 'MQ-LOCAL']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ],
];

$stmt = $pdo->prepare(
    "INSERT INTO reward_campaigns (
        id, name, start_at, end_at, points_multiplier, cashback_bonus_pp, caps_json, eligibility_rules_json, stackable, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        start_at = VALUES(start_at),
        end_at = VALUES(end_at),
        points_multiplier = VALUES(points_multiplier),
        cashback_bonus_pp = VALUES(cashback_bonus_pp),
        caps_json = VALUES(caps_json),
        eligibility_rules_json = VALUES(eligibility_rules_json),
        stackable = VALUES(stackable),
        status = VALUES(status)"
);

foreach ($campaigns as $campaign) {
    $stmt->execute([
        $campaign['id'],
        $campaign['name'],
        $start,
        $end,
        $campaign['points_multiplier'],
        $campaign['cashback_bonus_pp'],
        json_encode(['daily' => null, 'monthly' => null], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        $campaign['eligibility_rules_json'],
        $campaign['stackable'],
    ]);
}

rewards_json_response([
    'ok' => true,
    'seeded_campaigns' => array_column($campaigns, 'id'),
]);
