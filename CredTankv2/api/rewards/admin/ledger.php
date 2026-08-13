<?php
declare(strict_types=1);

require_once __DIR__ . '/../init.php';

rewards_require_method('GET');

$userId = trim((string) ($_GET['user_id'] ?? ''));
$type = trim((string) ($_GET['type'] ?? ''));
$status = trim((string) ($_GET['status'] ?? ''));
$dateFrom = trim((string) ($_GET['date_from'] ?? ''));
$dateTo = trim((string) ($_GET['date_to'] ?? ''));
$page = max(1, (int) ($_GET['page'] ?? 1));
$pageSize = min(200, max(1, (int) ($_GET['page_size'] ?? 50)));
$offset = ($page - 1) * $pageSize;
$export = strtolower(trim((string) ($_GET['export'] ?? '')));

$where = [];
$params = [];

if ($userId !== '') {
    $where[] = 'user_id = ?';
    $params[] = $userId;
}
if ($type !== '') {
    $where[] = 'type = ?';
    $params[] = $type;
}
if ($status !== '') {
    $where[] = 'status = ?';
    $params[] = $status;
}
if ($dateFrom !== '') {
    $where[] = 'created_at >= ?';
    $params[] = rewards_to_mysql_datetime($dateFrom);
}
if ($dateTo !== '') {
    $where[] = 'created_at <= ?';
    $params[] = rewards_to_mysql_datetime($dateTo);
}

$sqlWhere = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

$countStmt = $pdo->prepare('SELECT COUNT(*) FROM reward_ledgers ' . $sqlWhere);
$countStmt->execute($params);
$total = (int) $countStmt->fetchColumn();

if ($export === 'csv') {
    $listStmt = $pdo->prepare('SELECT * FROM reward_ledgers ' . $sqlWhere . ' ORDER BY created_at DESC LIMIT 5000');
    $listStmt->execute($params);
    $rows = $listStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $out = fopen('php://temp', 'w+');
    fputcsv($out, [
        'id', 'user_id', 'external_transaction_id', 'type', 'status', 'amount_points', 'amount_cashback',
        'base_amount', 'eligible_amount', 'campaign_id', 'available_at', 'expires_at', 'related_ledger_id',
        'created_by', 'source', 'created_at', 'metadata'
    ]);
    foreach ($rows as $row) {
        fputcsv($out, [
            $row['id'] ?? '',
            $row['user_id'] ?? '',
            $row['external_transaction_id'] ?? '',
            $row['type'] ?? '',
            $row['status'] ?? '',
            (string) ($row['amount_points'] ?? 0),
            rewards_decimal_from_db($row['amount_cashback'] ?? '0'),
            rewards_decimal_from_db($row['base_amount'] ?? '0'),
            rewards_decimal_from_db($row['eligible_amount'] ?? '0'),
            $row['campaign_id'] ?? '',
            $row['available_at'] ?? '',
            $row['expires_at'] ?? '',
            $row['related_ledger_id'] ?? '',
            $row['created_by'] ?? '',
            $row['source'] ?? '',
            $row['created_at'] ?? '',
            $row['metadata'] ?? '',
        ]);
    }
    rewind($out);
    $csv = stream_get_contents($out) ?: '';
    fclose($out);

    rewards_csv_response($csv, 'rewards_ledger_' . date('Ymd_His') . '.csv');
}

$listSql = 'SELECT * FROM reward_ledgers ' . $sqlWhere . ' ORDER BY created_at DESC LIMIT ' . (int) $pageSize . ' OFFSET ' . (int) $offset;
$listStmt = $pdo->prepare($listSql);
$listStmt->execute($params);
$rows = $listStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

rewards_json_response([
    'ok' => true,
    'page' => $page,
    'page_size' => $pageSize,
    'total' => $total,
    'rows' => array_map('rewards_ledger_row_to_api', $rows),
]);
