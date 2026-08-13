<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function db_env(string $key, string $fallback = ''): string
{
    $value = getenv($key);
    if ($value === false || $value === null || $value === '') {
        $serverValue = $_SERVER[$key] ?? $_ENV[$key] ?? '';
        if (is_string($serverValue) && trim($serverValue) !== '') {
            return trim($serverValue);
        }
        return $fallback;
    }
    return trim((string) $value);
}

function db_candidate_hosts(string $primaryHost): array
{
    $fallbackRaw = db_env('DB_HOST_FALLBACK', '');
    $fallbacks = [];
    if ($fallbackRaw !== '') {
        $parts = preg_split('/[,\s;]+/', $fallbackRaw);
        if (is_array($parts)) {
            foreach ($parts as $part) {
                $host = trim((string) $part);
                if ($host !== '') {
                    $fallbacks[] = $host;
                }
            }
        }
    }

    $hosts = array_merge([$primaryHost], $fallbacks, ['localhost', '127.0.0.1']);
    $hosts = array_map(static function ($value): string {
        return trim((string) $value);
    }, $hosts);
    $hosts = array_filter($hosts, static function ($value): bool {
        return $value !== '';
    });
    return array_values(array_unique($hosts));
}

function db_connect(): PDO
{
    $host = db_env('DB_HOST', DB_HOST);
    $port = db_env('DB_PORT', '');
    $name = db_env('DB_NAME', DB_NAME);
    $user = db_env('DB_USER', DB_USER);
    $pass = db_env('DB_PASS', DB_PASS);
    $charset = db_env('DB_CHARSET', 'utf8mb4');
    $socket = db_env('DB_SOCKET', '');

    if ($name === '' || $user === '') {
        throw new RuntimeException('missing_db_config');
    }

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 10,
    ];

    if ($socket !== '') {
        $dsn = 'mysql:unix_socket=' . $socket . ';dbname=' . $name . ';charset=' . $charset;
        return new PDO($dsn, $user, $pass, $options);
    }

    $lastError = null;
    foreach (db_candidate_hosts($host) as $candidateHost) {
        $dsn = 'mysql:host=' . $candidateHost . ';dbname=' . $name . ';charset=' . $charset;
        if ($port !== '') {
            $dsn .= ';port=' . (int) $port;
        }
        try {
            return new PDO($dsn, $user, $pass, $options);
        } catch (Throwable $error) {
            $lastError = $error;
        }
    }

    if ($lastError instanceof Throwable) {
        throw $lastError;
    }
    throw new RuntimeException('db_connect_failed');
}
