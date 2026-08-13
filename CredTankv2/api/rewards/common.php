<?php
declare(strict_types=1);

function rewards_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function rewards_csv_response(string $csv, string $filename = 'rewards_ledger.csv'): void
{
    http_response_code(200);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=' . $filename);
    echo $csv;
    exit;
}

function rewards_read_json_body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
        rewards_json_response(['ok' => false, 'error' => 'invalid_json'], 400);
    }
    return is_array($decoded) ? $decoded : [];
}

function rewards_require_method(string $method): void
{
    $incoming = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (strtoupper($incoming) !== strtoupper($method)) {
        rewards_json_response(['ok' => false, 'error' => 'method_not_allowed'], 405);
    }
}

function rewards_uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function rewards_now(): DateTimeImmutable
{
    return new DateTimeImmutable('now');
}

function rewards_parse_datetime($value): DateTimeImmutable
{
    if ($value instanceof DateTimeInterface) {
        return new DateTimeImmutable($value->format(DATE_ATOM));
    }
    if (is_string($value) && trim($value) !== '') {
        try {
            return new DateTimeImmutable($value);
        } catch (Throwable $e) {
            return rewards_now();
        }
    }
    return rewards_now();
}

function rewards_to_mysql_datetime($value): string
{
    return rewards_parse_datetime($value)->format('Y-m-d H:i:s');
}

function rewards_money_to_cents($value): int
{
    if (is_int($value)) {
        return $value * 100;
    }
    if (is_float($value)) {
        $normalized = number_format($value, 2, '.', '');
    } else {
        $normalized = trim((string) $value);
        $normalized = str_replace(['R$', ' '], '', $normalized);
        $normalized = str_replace('.', '', $normalized);
        $normalized = str_replace(',', '.', $normalized);
        if ($normalized === '' || $normalized === '-') {
            return 0;
        }
    }

    if (!preg_match('/^-?\d+(\.\d{1,4})?$/', $normalized)) {
        return 0;
    }

    $negative = str_starts_with($normalized, '-');
    $normalized = ltrim($normalized, '+-');
    [$whole, $fraction] = array_pad(explode('.', $normalized, 2), 2, '');
    $whole = $whole === '' ? '0' : $whole;
    $fraction = str_pad(substr($fraction, 0, 3), 3, '0');

    $numerator = ((int) $whole * 1000) + (int) $fraction;
    $cents = rewards_round_div_even($numerator, 10);

    return $negative ? -$cents : $cents;
}

function rewards_cents_to_decimal(int $cents): string
{
    $negative = $cents < 0 ? '-' : '';
    $abs = abs($cents);
    $whole = intdiv($abs, 100);
    $fraction = $abs % 100;
    return sprintf('%s%d.%02d', $negative, $whole, $fraction);
}

function rewards_round_div_even(int $numerator, int $denominator): int
{
    if ($denominator <= 0) {
        throw new InvalidArgumentException('denominator must be positive');
    }
    if ($numerator === 0) {
        return 0;
    }

    $negative = $numerator < 0;
    $n = abs($numerator);

    $quotient = intdiv($n, $denominator);
    $remainder = $n % $denominator;

    if ($remainder === 0) {
        return $negative ? -$quotient : $quotient;
    }

    $double = $remainder * 2;
    if ($double > $denominator) {
        $quotient++;
    } elseif ($double === $denominator) {
        if ($quotient % 2 !== 0) {
            $quotient++;
        }
    }

    return $negative ? -$quotient : $quotient;
}

function rewards_months_after(DateTimeImmutable $base, ?int $months): ?string
{
    if ($months === null || $months <= 0) {
        return null;
    }
    return $base->modify('+' . $months . ' months')->format('Y-m-d H:i:s');
}

function rewards_extract_audit_metadata(array $incoming = []): array
{
    $metadata = [];
    if (isset($incoming['metadata']) && is_array($incoming['metadata'])) {
        $metadata = $incoming['metadata'];
    }
    $metadata['ip'] = $metadata['ip'] ?? ($_SERVER['REMOTE_ADDR'] ?? '');
    $metadata['user_agent'] = $metadata['user_agent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? '');
    return $metadata;
}

function rewards_decimal_to_cents($value): int
{
    return rewards_money_to_cents((string) $value);
}

function rewards_decimal_from_db($value): string
{
    if ($value === null || $value === '') {
        return '0.00';
    }
    if (is_numeric($value)) {
        return number_format((float) $value, 2, '.', '');
    }
    return '0.00';
}

function rewards_is_truthy($value): bool
{
    if (is_bool($value)) {
        return $value;
    }
    $text = strtolower(trim((string) $value));
    return in_array($text, ['1', 'true', 'on', 'yes', 'sim'], true);
}
