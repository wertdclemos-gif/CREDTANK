<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

require_once __DIR__ . '/bootstrap.php';

try {
    $pdo = db_connect();
    ensure_tables($pdo);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'db_unavailable']);
    exit;
}

function pr_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function pr_now(): DateTimeImmutable
{
    return new DateTimeImmutable('now');
}

function pr_normalize_cpf($value): string
{
    return preg_replace('/\D+/', '', (string) $value) ?: '';
}

function pr_normalize_phone($value): string
{
    return preg_replace('/\D+/', '', (string) $value) ?: '';
}

function pr_normalize_email($value): string
{
    return strtolower(trim((string) $value));
}

function pr_is_access_password_strong(string $senha): bool
{
    if (strlen($senha) < 6) {
        return false;
    }
    if (!preg_match('/[A-Z]/', $senha)) {
        return false;
    }
    if (!preg_match('/[a-z]/', $senha)) {
        return false;
    }
    if (!preg_match('/[^A-Za-z0-9]/', $senha)) {
        return false;
    }
    return true;
}

function pr_is_localhost(): bool
{
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $host = preg_replace('/:\d+$/', '', $host);
    return in_array($host, ['localhost', '127.0.0.1', '::1'], true);
}

function pr_mask_email(string $email): string
{
    $email = pr_normalize_email($email);
    $parts = explode('@', $email, 2);
    if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') {
        return '--';
    }
    [$local, $domain] = $parts;
    $domainParts = explode('.', $domain);
    $domainMain = array_shift($domainParts) ?: '';
    $domainSuffix = $domainParts ? '.' . implode('.', $domainParts) : '';
    $localPrefix = substr($local, 0, min(2, strlen($local)));
    $domainPrefix = substr($domainMain, 0, min(2, strlen($domainMain)));
    $localMask = str_repeat('*', max(1, strlen($local) - strlen($localPrefix)));
    $domainMask = str_repeat('*', max(1, strlen($domainMain) - strlen($domainPrefix)));
    return $localPrefix . $localMask . '@' . $domainPrefix . $domainMask . $domainSuffix;
}

function pr_mask_phone(string $phone): string
{
    $digits = pr_normalize_phone($phone);
    if ($digits === '') {
        return '--';
    }
    if (strlen($digits) <= 4) {
        return str_repeat('*', strlen($digits));
    }
    $prefix = substr($digits, 0, min(2, strlen($digits) - 2));
    $suffix = substr($digits, -2);
    $mask = str_repeat('*', max(2, strlen($digits) - 4));
    return $prefix . $mask . $suffix;
}

function pr_generate_code(): string
{
    return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

function pr_generate_token(int $bytes = 24): string
{
    try {
        $raw = random_bytes(max(16, $bytes));
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    } catch (Throwable $e) {
        return sha1(uniqid('pr_', true) . microtime(true));
    }
}

function pr_current_scheme(): string
{
    $https = strtolower((string) ($_SERVER['HTTPS'] ?? ''));
    if ($https !== '' && $https !== 'off' && $https !== '0') {
        return 'https';
    }
    $forwarded = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
    if ($forwarded === 'https') {
        return 'https';
    }
    return 'http';
}

function pr_mail_sender_domain(): string
{
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'credtank.com');
    $host = preg_replace('/:\d+$/', '', $host);
    $domain = preg_replace('/^www\./i', '', $host);
    if (!$domain || strpos($domain, '.') === false) {
        return 'credtank.com';
    }
    return strtolower($domain);
}

function pr_get_config_value(string $constName, string $envName): string
{
    if (defined($constName)) {
        $value = trim((string) constant($constName));
        if ($value !== '') {
            return $value;
        }
    }
    $env = getenv($envName);
    if ($env !== false) {
        $value = trim((string) $env);
        if ($value !== '') {
            return $value;
        }
    }
    return '';
}

function pr_mail_sender_email(): string
{
    $custom = pr_get_config_value('APP_MAIL_FROM', 'APP_MAIL_FROM');
    if ($custom !== '' && filter_var($custom, FILTER_VALIDATE_EMAIL)) {
        return strtolower($custom);
    }
    $smtpUser = pr_get_config_value('APP_SMTP_USER', 'APP_SMTP_USER');
    if ($smtpUser !== '' && filter_var($smtpUser, FILTER_VALIDATE_EMAIL)) {
        return strtolower($smtpUser);
    }
    return 'noreply@' . pr_mail_sender_domain();
}

function pr_smtp_read($socket): string
{
    $data = '';
    while (!feof($socket)) {
        $line = fgets($socket, 515);
        if ($line === false) {
            break;
        }
        $data .= $line;
        if (preg_match('/^\d{3}\s/', $line)) {
            break;
        }
    }
    return $data;
}

function pr_smtp_expect($socket, array $codes, ?string &$response = null): bool
{
    $resp = pr_smtp_read($socket);
    $response = $resp;
    if ($resp === '') {
        return false;
    }
    $code = (int) substr($resp, 0, 3);
    return in_array($code, $codes, true);
}

function pr_smtp_send($socket, string $command): bool
{
    return fwrite($socket, $command . "\r\n") !== false;
}

function pr_send_email_via_php_mail(
    string $toEmail,
    string $subject,
    string $textBody,
    string $fromEmail,
    string $replyEmail
): bool {
    $headers = [
        'From: CredTank <' . $fromEmail . '>',
        'Reply-To: ' . $replyEmail,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
    ];
    $rawHeaders = implode("\r\n", $headers);
    $sent = @mail($toEmail, $subject, $textBody, $rawHeaders, '-f' . $fromEmail);
    if (!$sent) {
        $sent = @mail($toEmail, $subject, $textBody, $rawHeaders);
    }
    return (bool) $sent;
}

function pr_smtp_auth($socket, string $user, string $pass): bool
{
    $resp = '';
    if (pr_smtp_send($socket, 'AUTH LOGIN') && pr_smtp_expect($socket, [334], $resp)) {
        if (pr_smtp_send($socket, base64_encode($user)) && pr_smtp_expect($socket, [334], $resp)) {
            if (pr_smtp_send($socket, base64_encode($pass)) && pr_smtp_expect($socket, [235], $resp)) {
                return true;
            }
        }
    }
    $plain = base64_encode("\0" . $user . "\0" . $pass);
    if (pr_smtp_send($socket, 'AUTH PLAIN ' . $plain) && pr_smtp_expect($socket, [235], $resp)) {
        return true;
    }
    return false;
}

function pr_send_email_via_smtp_attempt(
    string $host,
    int $port,
    string $secure,
    string $user,
    string $pass,
    string $toEmail,
    string $fromEmail,
    string $replyEmail,
    string $domain,
    string $encodedSubject,
    string $body,
    string $boundary
): array {
    $transport = $secure === 'ssl' ? 'ssl://' . $host : $host;
    $socket = @stream_socket_client($transport . ':' . $port, $errno, $errstr, 20);
    if (!$socket) {
        return ['ok' => false, 'error' => 'mail_connect_failed'];
    }
    stream_set_timeout($socket, 20);
    try {
        $resp = '';
        if (!pr_smtp_expect($socket, [220], $resp)) {
            return ['ok' => false, 'error' => 'mail_handshake_failed'];
        }
        if (!pr_smtp_send($socket, 'EHLO ' . $domain) || !pr_smtp_expect($socket, [250], $resp)) {
            return ['ok' => false, 'error' => 'mail_ehlo_failed'];
        }
        if ($secure === 'tls') {
            if (!pr_smtp_send($socket, 'STARTTLS') || !pr_smtp_expect($socket, [220], $resp)) {
                return ['ok' => false, 'error' => 'mail_starttls_failed'];
            }
            if (!@stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                return ['ok' => false, 'error' => 'mail_tls_failed'];
            }
            if (!pr_smtp_send($socket, 'EHLO ' . $domain) || !pr_smtp_expect($socket, [250], $resp)) {
                return ['ok' => false, 'error' => 'mail_ehlo_failed'];
            }
        }
        if (!pr_smtp_auth($socket, $user, $pass)) {
            return ['ok' => false, 'error' => 'mail_auth_failed'];
        }
        if (!pr_smtp_send($socket, 'MAIL FROM:<' . $fromEmail . '>') || !pr_smtp_expect($socket, [250], $resp)) {
            return ['ok' => false, 'error' => 'mail_from_rejected'];
        }
        if (!pr_smtp_send($socket, 'RCPT TO:<' . $toEmail . '>') || !pr_smtp_expect($socket, [250, 251], $resp)) {
            return ['ok' => false, 'error' => 'mail_rcpt_rejected'];
        }
        if (!pr_smtp_send($socket, 'DATA') || !pr_smtp_expect($socket, [354], $resp)) {
            return ['ok' => false, 'error' => 'mail_data_failed'];
        }
        $headers = [
            'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
            'From: CredTank <' . $fromEmail . '>',
            'Reply-To: ' . $replyEmail,
            'To: <' . $toEmail . '>',
            'Subject: ' . $encodedSubject,
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];
        $message = implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n.";
        if (fwrite($socket, $message . "\r\n") === false) {
            return ['ok' => false, 'error' => 'mail_send_failed'];
        }
        if (!pr_smtp_expect($socket, [250], $resp)) {
            return ['ok' => false, 'error' => 'mail_send_rejected'];
        }
        pr_smtp_send($socket, 'QUIT');
        return ['ok' => true];
    } finally {
        fclose($socket);
    }
}

function pr_send_email_via_smtp(
    string $toEmail,
    string $fromEmail,
    string $replyEmail,
    string $domain,
    string $encodedSubject,
    string $body,
    string $boundary
): array {
    $host = pr_get_config_value('APP_SMTP_HOST', 'APP_SMTP_HOST');
    if ($host === '') {
        return ['ok' => false, 'error' => 'mail_not_configured'];
    }
    $port = (int) pr_get_config_value('APP_SMTP_PORT', 'APP_SMTP_PORT');
    if ($port <= 0) {
        $port = 587;
    }
    $user = pr_get_config_value('APP_SMTP_USER', 'APP_SMTP_USER');
    $pass = pr_get_config_value('APP_SMTP_PASS', 'APP_SMTP_PASS');
    $secure = strtolower(pr_get_config_value('APP_SMTP_SECURE', 'APP_SMTP_SECURE')); // tls|ssl|none
    if ($secure === '') {
        $secure = 'tls';
    }
    if ($user === '' || $pass === '') {
        return ['ok' => false, 'error' => 'mail_not_configured'];
    }
    $attempts = [];
    $attempts[] = ['secure' => $secure, 'port' => $port];
    if (!($secure === 'tls' && $port === 587)) {
        $attempts[] = ['secure' => 'tls', 'port' => 587];
    }
    if (!($secure === 'ssl' && $port === 465)) {
        $attempts[] = ['secure' => 'ssl', 'port' => 465];
    }
    if (!($secure === 'none' && $port === 25)) {
        $attempts[] = ['secure' => 'none', 'port' => 25];
    }

    $lastError = 'mail_failed';
    foreach ($attempts as $attempt) {
        $result = pr_send_email_via_smtp_attempt(
            $host,
            (int) $attempt['port'],
            (string) $attempt['secure'],
            $user,
            $pass,
            $toEmail,
            $fromEmail,
            $replyEmail,
            $domain,
            $encodedSubject,
            $body,
            $boundary
        );
        if (!empty($result['ok'])) {
            return ['ok' => true];
        }
        $lastError = (string) ($result['error'] ?? 'mail_failed');
    }
    return ['ok' => false, 'error' => $lastError];
}

function pr_send_email_code(string $toEmail, string $nome, string $maskedEmail, string $code): array
{
    $domain = pr_mail_sender_domain();
    $fromEmail = pr_mail_sender_email();
    $replyEmail = $fromEmail;
    if (!filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'mail_from_invalid'];
    }

    $subject = 'Codigo de redefinicao CredTank';
    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $safeName = htmlspecialchars($nome !== '' ? $nome : 'Colaborador', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeMasked = htmlspecialchars($maskedEmail, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeCode = htmlspecialchars($code, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    $html = '<!doctype html><html><body style="margin:0;background:#eef3f1;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;">'
        . '<tr><td align="center">'
        . '<table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dce7e2;">'
        . '<tr><td style="padding:22px 28px;background:linear-gradient(135deg,#e8f7f0,#d7f0e4 55%,#f2faf6);">'
        . '<h1 style="margin:0;font-size:22px;color:#0b6b4a;">CredTank</h1>'
        . '<p style="margin:6px 0 0 0;font-size:13px;color:#3d6b58;">Seguranca da conta corporativa</p>'
        . '</td></tr>'
        . '<tr><td style="padding:28px;">'
        . '<p style="margin:0 0 14px 0;font-size:15px;">Ola, <strong>' . $safeName . '</strong>.</p>'
        . '<p style="margin:0 0 12px 0;line-height:1.55;">Recebemos uma solicitacao para redefinir a senha da conta <strong>' . $safeMasked . '</strong>.</p>'
        . '<p style="margin:0 0 12px 0;line-height:1.55;">Use o codigo abaixo para redefinir sua senha no site da CredTank:</p>'
        . '<p style="margin:0 0 18px 0;text-align:center;">'
        . '<span style="display:inline-block;background:#138a5b;color:#ffffff;padding:12px 20px;border-radius:10px;font-weight:700;font-size:22px;letter-spacing:3px;">' . $safeCode . '</span>'
        . '</p>'
        . '<p style="margin:0 0 10px 0;font-size:13px;color:#334155;"><strong>Validade do codigo:</strong> 10 minutos.</p>'
        . '</td></tr>'
        . '<tr><td style="padding:15px 28px;background:#f8faf9;font-size:12px;color:#64748b;line-height:1.45;">'
        . 'Se voce nao solicitou esta redefinicao, ignore este email.'
        . '</td></tr>'
        . '</table>'
        . '</td></tr></table></body></html>';

    $text = "CredTank - Codigo de redefinicao\n\n";
    $text .= "Ola, {$nome}.\n";
    $text .= "Conta: {$maskedEmail}\n";
    $text .= "Codigo: {$code}\n";
    $text .= "Validade: 10 minutos.\n\n";
    $text .= "Se voce nao solicitou esta redefinicao, ignore este email.\n";

    try {
        $boundary = '=_CredTank_' . bin2hex(random_bytes(12));
    } catch (Throwable $e) {
        $boundary = '=_CredTank_' . md5((string) microtime(true));
    }
    $body = '';
    $body .= "--{$boundary}\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
    $body .= quoted_printable_encode($text) . "\r\n";
    $body .= "--{$boundary}\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
    $body .= quoted_printable_encode($html) . "\r\n";
    $body .= "--{$boundary}--\r\n";

    $messageId = '<' . uniqid('code_', true) . '@' . $domain . '>';
    $headers = [
        'MIME-Version: 1.0',
        'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
        'Message-ID: ' . $messageId,
        'X-Mailer: CredTank Password Reset',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        'From: CredTank <' . $fromEmail . '>',
        'Sender: ' . $fromEmail,
        'Reply-To: ' . $replyEmail,
    ];
    $headersRaw = implode("\r\n", $headers);

    $smtpHost = pr_get_config_value('APP_SMTP_HOST', 'APP_SMTP_HOST');
    $smtpUser = pr_get_config_value('APP_SMTP_USER', 'APP_SMTP_USER');
    $smtpPass = pr_get_config_value('APP_SMTP_PASS', 'APP_SMTP_PASS');
    $smtpConfigured = $smtpHost !== '' && $smtpUser !== '' && $smtpPass !== '';

    if (pr_send_email_via_php_mail($toEmail, $subject, $text, $fromEmail, $replyEmail)) {
        return ['ok' => true];
    }

    $smtpResult = pr_send_email_via_smtp(
        $toEmail,
        $fromEmail,
        $replyEmail,
        $domain,
        $encodedSubject,
        $body,
        $boundary
    );
    $sent = !empty($smtpResult['ok']);
    if (!$sent) {
        return [
            'ok' => false,
            'error' => (string) ($smtpResult['error'] ?? ($smtpConfigured ? 'mail_failed' : 'mail_not_configured')),
        ];
    }
    return ['ok' => true];
}

function pr_build_reset_link(string $token): string
{
    $configured = pr_get_config_value('APP_PORTAL_RESET_URL', 'APP_PORTAL_RESET_URL');
    if ($configured !== '' && filter_var($configured, FILTER_VALIDATE_URL)) {
        $base = $configured;
    } else {
        $host = trim((string) ($_SERVER['HTTP_HOST'] ?? 'credtank.com'));
        if ($host === '') {
            $host = 'credtank.com';
        }
        $scriptName = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? '/api/password_reset.php'));
        $rootPath = preg_replace('#/api/[^/]+$#', '', $scriptName);
        if (!is_string($rootPath)) {
            $rootPath = '';
        }
        $rootPath = rtrim($rootPath, '/');
        $base = pr_current_scheme() . '://' . $host . $rootPath . '/portal/app.html';
    }
    $separator = strpos($base, '?') === false ? '?' : '&';
    return $base . $separator . 'role=colaborador&reset_token=' . rawurlencode($token);
}

function pr_send_email_reset_link(
    string $toEmail,
    string $nome,
    string $maskedEmail,
    string $resetLink
): array {
    $domain = pr_mail_sender_domain();
    $fromEmail = pr_mail_sender_email();
    $smtpUser = pr_get_config_value('APP_SMTP_USER', 'APP_SMTP_USER');
    if (!filter_var($fromEmail, FILTER_VALIDATE_EMAIL) && filter_var($smtpUser, FILTER_VALIDATE_EMAIL)) {
        $fromEmail = strtolower($smtpUser);
    }
    $replyEmail = $fromEmail;
    if (!filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'mail_from_invalid'];
    }

    $subject = 'Redefinicao de senha CredTank';
    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $safeName = htmlspecialchars($nome !== '' ? $nome : 'Colaborador', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeMasked = htmlspecialchars($maskedEmail, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeLink = htmlspecialchars($resetLink, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    $html = '<!doctype html><html><body style="margin:0;background:#eef3f1;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">'
        . '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;">'
        . '<tr><td align="center">'
        . '<table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dce7e2;">'
        . '<tr><td style="padding:22px 28px;background:linear-gradient(135deg,#e8f7f0,#d7f0e4 55%,#f2faf6);">'
        . '<h1 style="margin:0;font-size:22px;color:#0b6b4a;">CredTank</h1>'
        . '<p style="margin:6px 0 0 0;font-size:13px;color:#3d6b58;">Seguranca da conta corporativa</p>'
        . '</td></tr>'
        . '<tr><td style="padding:28px;">'
        . '<p style="margin:0 0 14px 0;font-size:15px;">Ola, <strong>' . $safeName . '</strong>.</p>'
        . '<p style="margin:0 0 12px 0;line-height:1.55;">Recebemos uma solicitacao para redefinir a senha da conta <strong>' . $safeMasked . '</strong>.</p>'
        . '<p style="margin:0 0 18px 0;line-height:1.55;">Para continuar com seguranca, clique no botao abaixo e defina uma nova senha no site da CredTank.</p>'
        . '<p style="margin:0 0 18px 0;text-align:center;">'
        . '<a href="' . $safeLink . '" style="display:inline-block;background:#138a5b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:15px;">Redefinir minha senha</a>'
        . '</p>'
        . '<p style="margin:0 0 10px 0;font-size:13px;color:#334155;"><strong>Validade do link:</strong> 30 minutos.</p>'
        . '<p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">Se o botao nao funcionar, copie e cole o link abaixo no navegador:</p>'
        . '<p style="margin:8px 0 0 0;word-break:break-all;font-size:12px;color:#0f172a;">' . $safeLink . '</p>'
        . '</td></tr>'
        . '<tr><td style="padding:15px 28px;background:#f8faf9;font-size:12px;color:#64748b;line-height:1.45;">'
        . 'Se voce nao solicitou esta redefinicao, ignore este email.'
        . '</td></tr>'
        . '</table>'
        . '</td></tr></table></body></html>';

    $text = "CredTank - Redefinicao de senha\n\n";
    $text .= "Ola, {$nome}.\n";
    $text .= "Conta: {$maskedEmail}\n";
    $text .= "Acesse o link abaixo para redefinir sua senha (valido por 30 minutos):\n";
    $text .= "{$resetLink}\n\n";
    $text .= "Se voce nao solicitou esta redefinicao, ignore este email.\n";

    try {
        $boundary = '=_CredTank_' . bin2hex(random_bytes(12));
    } catch (Throwable $e) {
        $boundary = '=_CredTank_' . md5((string) microtime(true));
    }
    $body = '';
    $body .= "--{$boundary}\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
    $body .= quoted_printable_encode($text) . "\r\n";
    $body .= "--{$boundary}\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: quoted-printable\r\n\r\n";
    $body .= quoted_printable_encode($html) . "\r\n";
    $body .= "--{$boundary}--\r\n";

    $messageId = '<' . uniqid('reset_', true) . '@' . $domain . '>';
    $headers = [
        'MIME-Version: 1.0',
        'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
        'Message-ID: ' . $messageId,
        'X-Mailer: CredTank Password Reset',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        'From: CredTank <' . $fromEmail . '>',
        'Sender: ' . $fromEmail,
        'Reply-To: ' . $replyEmail,
    ];
    $headersRaw = implode("\r\n", $headers);

    $smtpHost = pr_get_config_value('APP_SMTP_HOST', 'APP_SMTP_HOST');
    $smtpUser = pr_get_config_value('APP_SMTP_USER', 'APP_SMTP_USER');
    $smtpPass = pr_get_config_value('APP_SMTP_PASS', 'APP_SMTP_PASS');
    $smtpConfigured = $smtpHost !== '' && $smtpUser !== '' && $smtpPass !== '';

    if (pr_send_email_via_php_mail($toEmail, $subject, $text, $fromEmail, $replyEmail)) {
        return ['ok' => true];
    }

    $smtpResult = pr_send_email_via_smtp(
        $toEmail,
        $fromEmail,
        $replyEmail,
        $domain,
        $encodedSubject,
        $body,
        $boundary
    );
    $sent = !empty($smtpResult['ok']);
    if (!$sent) {
        return [
            'ok' => false,
            'error' => (string) ($smtpResult['error'] ?? ($smtpConfigured ? 'mail_failed' : 'mail_not_configured')),
        ];
    }
    return ['ok' => true];
}

function pr_send_phone_code(string $phone, string $nome, string $code): array
{
    $webhookUrl = pr_get_config_value('APP_SMS_WEBHOOK_URL', 'APP_SMS_WEBHOOK_URL');
    if ($webhookUrl === '') {
        if (pr_is_localhost()) {
            return ['ok' => true, 'debug' => true];
        }
        return ['ok' => false, 'error' => 'sms_not_configured'];
    }
    $token = pr_get_config_value('APP_SMS_WEBHOOK_TOKEN', 'APP_SMS_WEBHOOK_TOKEN');
    $payload = [
        'phone' => $phone,
        'name' => $nome,
        'code' => $code,
        'message' => "CredTank: seu codigo de redefinicao e {$code}. Valido por 10 minutos.",
    ];
    $headers = "Content-Type: application/json\r\n";
    if ($token !== '') {
        $headers .= "Authorization: Bearer {$token}\r\n";
    }
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => $headers,
            'content' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'timeout' => 15,
            'ignore_errors' => true,
        ],
    ]);
    $result = @file_get_contents($webhookUrl, false, $context);
    $statusLine = $http_response_header[0] ?? '';
    if (preg_match('/\s(\d{3})\s/', $statusLine, $m)) {
        $status = (int) $m[1];
        if ($status >= 200 && $status < 300) {
            return ['ok' => true];
        }
    }
    if ($result !== false && pr_is_localhost()) {
        return ['ok' => true, 'debug' => true];
    }
    return ['ok' => false, 'error' => 'sms_failed'];
}

function pr_load_state(PDO $pdo): array
{
    $stmt = $pdo->query('SELECT data FROM app_state WHERE id = 1');
    $row = $stmt->fetch();
    if (!$row) {
        return [];
    }
    $decoded = json_decode((string) ($row['data'] ?? ''), true);
    return is_array($decoded) ? $decoded : [];
}

function pr_save_state(PDO $pdo, array $state): bool
{
    $payload = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($payload === false) {
        return false;
    }
    $stmt = $pdo->prepare(
        'INSERT INTO app_state (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)'
    );
    return $stmt->execute([$payload]);
}

function pr_find_funcionario_by_cpf(array $state, string $cpf): ?array
{
    $funcionarios = $state['funcionarios'] ?? [];
    if (!is_array($funcionarios)) {
        return null;
    }
    foreach ($funcionarios as $funcionario) {
        if (!is_array($funcionario)) {
            continue;
        }
        if (pr_normalize_cpf($funcionario['cpf'] ?? '') === $cpf) {
            return $funcionario;
        }
    }
    return null;
}

function pr_cleanup_codes(array $codes): array
{
    $nowTs = pr_now()->getTimestamp();
    $safe = [];
    foreach ($codes as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $expiresAt = strtotime((string) ($entry['expiresAt'] ?? ''));
        $usedAt = (string) ($entry['usedAt'] ?? '');
        if ($usedAt !== '') {
            continue;
        }
        if ($expiresAt !== false && $expiresAt > $nowTs) {
            $safe[] = $entry;
        }
    }
    return $safe;
}

function pr_cleanup_tokens(array $tokens): array
{
    $nowTs = pr_now()->getTimestamp();
    $safe = [];
    foreach ($tokens as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $expiresAt = strtotime((string) ($entry['expiresAt'] ?? ''));
        $usedAt = (string) ($entry['usedAt'] ?? '');
        if ($usedAt !== '') {
            continue;
        }
        if ($expiresAt !== false && $expiresAt > $nowTs) {
            $safe[] = $entry;
        }
    }
    return $safe;
}

function pr_match_token(array $tokens, string $token): array
{
    $nowTs = pr_now()->getTimestamp();
    for ($i = count($tokens) - 1; $i >= 0; $i -= 1) {
        $entry = $tokens[$i];
        if (!is_array($entry)) {
            continue;
        }
        $hash = (string) ($entry['tokenHash'] ?? '');
        if ($hash === '' || !password_verify($token, $hash)) {
            continue;
        }
        $usedAt = (string) ($entry['usedAt'] ?? '');
        $expiresAt = strtotime((string) ($entry['expiresAt'] ?? ''));
        if ($usedAt !== '' || ($expiresAt !== false && $expiresAt <= $nowTs)) {
            return ['status' => 'expired', 'index' => $i, 'entry' => $entry];
        }
        return ['status' => 'valid', 'index' => $i, 'entry' => $entry];
    }
    return ['status' => 'invalid', 'index' => null, 'entry' => null];
}

function pr_upsert_auth_password(array $authList, string $funcionarioId, string $cpf, string $senha): array
{
    $authIndex = null;
    foreach ($authList as $index => $auth) {
        if (!is_array($auth)) {
            continue;
        }
        if ((string) ($auth['funcionarioId'] ?? '') === $funcionarioId || pr_normalize_cpf($auth['cpf'] ?? '') === $cpf) {
            $authIndex = $index;
            break;
        }
    }
    if ($authIndex === null) {
        $authList[] = [
            'id' => 'COL-' . strtoupper(substr(bin2hex(random_bytes(6)), 0, 10)),
            'funcionarioId' => $funcionarioId,
            'cpf' => $cpf,
            'senha' => $senha,
            'biometriaCredIds' => [],
        ];
    } else {
        $auth = $authList[$authIndex];
        $auth['funcionarioId'] = $funcionarioId;
        $auth['cpf'] = $cpf;
        $auth['senha'] = $senha;
        $authList[$authIndex] = $auth;
    }
    return $authList;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    pr_json(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$raw = file_get_contents('php://input') ?: '';
$payload = json_decode($raw, true);
if (!is_array($payload)) {
    pr_json(['ok' => false, 'error' => 'invalid_json'], 400);
}

$action = strtolower(trim((string) ($payload['action'] ?? '')));

if ($action === 'request_email_link') {
    $cpf = pr_normalize_cpf($payload['cpf'] ?? '');
    if (strlen($cpf) !== 11) {
        pr_json(['ok' => false, 'error' => 'invalid_cpf'], 400);
    }

    $state = pr_load_state($pdo);
    $funcionario = pr_find_funcionario_by_cpf($state, $cpf);
    if (!$funcionario) {
        pr_json(['ok' => false, 'error' => 'colaborador_not_found'], 404);
    }

    $nome = trim((string) ($funcionario['nome'] ?? 'Colaborador'));
    $email = pr_normalize_email($funcionario['email'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        pr_json(['ok' => false, 'error' => 'email_not_found'], 400);
    }
    $maskedDestination = pr_mask_email($email);
    $token = pr_generate_token(28);
    $resetLink = pr_build_reset_link($token);
    $sendResult = pr_send_email_reset_link($email, $nome, $maskedDestination, $resetLink);
    if (!($sendResult['ok'] ?? false)) {
        if (pr_is_localhost()) {
            $sendResult = ['ok' => true, 'debug' => true];
        } else {
            pr_json(['ok' => false, 'error' => (string) ($sendResult['error'] ?? 'mail_failed')], 500);
        }
    }

    $tokens = pr_cleanup_tokens(is_array($state['passwordResetTokens'] ?? null) ? $state['passwordResetTokens'] : []);
    $tokens[] = [
        'id' => 'PRT-' . strtoupper(substr(md5(uniqid('t', true)), 0, 12)),
        'cpf' => $cpf,
        'funcionarioId' => (string) ($funcionario['id'] ?? ''),
        'channel' => 'email',
        'tokenHash' => password_hash($token, PASSWORD_DEFAULT),
        'createdAt' => pr_now()->format(DATE_ATOM),
        'expiresAt' => pr_now()->modify('+30 minutes')->format(DATE_ATOM),
        'usedAt' => '',
    ];
    $state['passwordResetTokens'] = $tokens;
    if (!pr_save_state($pdo, $state)) {
        pr_json(['ok' => false, 'error' => 'db_write_failed'], 500);
    }

    $response = [
        'ok' => true,
        'maskedDestination' => $maskedDestination,
    ];
    if (pr_is_localhost() || !empty($sendResult['debug'])) {
        $response['debugLink'] = $resetLink;
    }
    pr_json($response);
}

if ($action === 'request_phone_code') {
    $cpf = pr_normalize_cpf($payload['cpf'] ?? '');
    if (strlen($cpf) !== 11) {
        pr_json(['ok' => false, 'error' => 'invalid_cpf'], 400);
    }

    $state = pr_load_state($pdo);
    $funcionario = pr_find_funcionario_by_cpf($state, $cpf);
    if (!$funcionario) {
        pr_json(['ok' => false, 'error' => 'colaborador_not_found'], 404);
    }

    $nome = trim((string) ($funcionario['nome'] ?? 'Colaborador'));
    $phone = pr_normalize_phone($funcionario['telefone'] ?? '');
    if (strlen($phone) < 10) {
        pr_json(['ok' => false, 'error' => 'phone_not_found'], 400);
    }
    $maskedDestination = pr_mask_phone($phone);
    $code = pr_generate_code();
    $sendResult = pr_send_phone_code($phone, $nome, $code);
    $fallbackChannel = '';
    if (!($sendResult['ok'] ?? false)) {
        if (pr_is_localhost()) {
            $sendResult = ['ok' => true, 'debug' => true];
        } else {
            $email = pr_normalize_email($funcionario['email'] ?? '');
            if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $maskedEmail = pr_mask_email($email);
                $emailResult = pr_send_email_code($email, $nome, $maskedEmail, $code);
                if (!empty($emailResult['ok'])) {
                    $sendResult = ['ok' => true];
                    $maskedDestination = $maskedEmail;
                    $fallbackChannel = 'email';
                } else {
                    pr_json(['ok' => false, 'error' => (string) ($sendResult['error'] ?? 'sms_failed')], 500);
                }
            } else {
                pr_json(['ok' => false, 'error' => (string) ($sendResult['error'] ?? 'sms_failed')], 500);
            }
        }
    }

    $codes = pr_cleanup_codes(is_array($state['passwordResetCodes'] ?? null) ? $state['passwordResetCodes'] : []);
    $codes[] = [
        'id' => 'PRC-' . strtoupper(substr(md5(uniqid('c', true)), 0, 12)),
        'cpf' => $cpf,
        'funcionarioId' => (string) ($funcionario['id'] ?? ''),
        'channel' => 'phone',
        'codeHash' => password_hash($code, PASSWORD_DEFAULT),
        'createdAt' => pr_now()->format(DATE_ATOM),
        'expiresAt' => pr_now()->modify('+10 minutes')->format(DATE_ATOM),
        'usedAt' => '',
    ];
    $state['passwordResetCodes'] = $codes;
    if (!pr_save_state($pdo, $state)) {
        pr_json(['ok' => false, 'error' => 'db_write_failed'], 500);
    }

    $response = [
        'ok' => true,
        'maskedDestination' => $maskedDestination,
    ];
    if ($fallbackChannel !== '') {
        $response['fallbackChannel'] = $fallbackChannel;
    }
    if (pr_is_localhost() || !empty($sendResult['debug'])) {
        $response['debugCode'] = $code;
    }
    pr_json($response);
}

if ($action === 'verify_phone_code') {
    $cpf = pr_normalize_cpf($payload['cpf'] ?? '');
    $code = preg_replace('/\D+/', '', (string) ($payload['code'] ?? '')) ?: '';
    if (strlen($cpf) !== 11) {
        pr_json(['ok' => false, 'error' => 'invalid_cpf'], 400);
    }
    if (!preg_match('/^\d{6}$/', $code)) {
        pr_json(['ok' => false, 'error' => 'code_invalid'], 400);
    }

    $state = pr_load_state($pdo);
    $funcionario = pr_find_funcionario_by_cpf($state, $cpf);
    if (!$funcionario) {
        pr_json(['ok' => false, 'error' => 'colaborador_not_found'], 404);
    }

    $codes = pr_cleanup_codes(is_array($state['passwordResetCodes'] ?? null) ? $state['passwordResetCodes'] : []);
    $matchIndex = null;
    for ($i = count($codes) - 1; $i >= 0; $i -= 1) {
        $entry = $codes[$i];
        if (($entry['cpf'] ?? '') !== $cpf) {
            continue;
        }
        if (($entry['channel'] ?? '') !== 'phone') {
            continue;
        }
        if (!password_verify($code, (string) ($entry['codeHash'] ?? ''))) {
            continue;
        }
        $matchIndex = $i;
        break;
    }
    if ($matchIndex === null) {
        $hasPhoneCode = false;
        foreach ($codes as $entry) {
            if (($entry['cpf'] ?? '') === $cpf && ($entry['channel'] ?? '') === 'phone') {
                $hasPhoneCode = true;
                break;
            }
        }
        pr_json(['ok' => false, 'error' => $hasPhoneCode ? 'code_invalid' : 'code_expired'], 400);
    }

    $token = pr_generate_token(28);
    $tokens = pr_cleanup_tokens(is_array($state['passwordResetTokens'] ?? null) ? $state['passwordResetTokens'] : []);
    $tokens[] = [
        'id' => 'PRT-' . strtoupper(substr(md5(uniqid('t', true)), 0, 12)),
        'cpf' => $cpf,
        'funcionarioId' => (string) ($funcionario['id'] ?? ''),
        'channel' => 'phone',
        'tokenHash' => password_hash($token, PASSWORD_DEFAULT),
        'createdAt' => pr_now()->format(DATE_ATOM),
        'expiresAt' => pr_now()->modify('+20 minutes')->format(DATE_ATOM),
        'usedAt' => '',
    ];
    $codes[$matchIndex]['usedAt'] = pr_now()->format(DATE_ATOM);
    $state['passwordResetCodes'] = $codes;
    $state['passwordResetTokens'] = $tokens;
    if (!pr_save_state($pdo, $state)) {
        pr_json(['ok' => false, 'error' => 'db_write_failed'], 500);
    }

    pr_json([
        'ok' => true,
        'resetToken' => $token,
        'maskedDestination' => pr_mask_phone((string) ($funcionario['telefone'] ?? '')),
    ]);
}

if ($action === 'verify_token') {
    $token = trim((string) ($payload['token'] ?? ''));
    if ($token === '') {
        pr_json(['ok' => false, 'error' => 'token_invalid'], 400);
    }

    $state = pr_load_state($pdo);
    $tokens = is_array($state['passwordResetTokens'] ?? null) ? $state['passwordResetTokens'] : [];
    $match = pr_match_token($tokens, $token);
    if (($match['status'] ?? '') === 'expired') {
        pr_json(['ok' => false, 'error' => 'token_expired'], 400);
    }
    if (($match['status'] ?? '') !== 'valid' || !is_array($match['entry'] ?? null)) {
        pr_json(['ok' => false, 'error' => 'token_invalid'], 400);
    }

    $entry = $match['entry'];
    $cpf = pr_normalize_cpf($entry['cpf'] ?? '');
    $funcionario = pr_find_funcionario_by_cpf($state, $cpf);
    if (!$funcionario) {
        pr_json(['ok' => false, 'error' => 'colaborador_not_found'], 404);
    }
    $channel = strtolower((string) ($entry['channel'] ?? 'email'));
    $maskedDestination = $channel === 'phone'
        ? pr_mask_phone((string) ($funcionario['telefone'] ?? ''))
        : pr_mask_email((string) ($funcionario['email'] ?? ''));
    pr_json([
        'ok' => true,
        'channel' => $channel,
        'cpf' => $cpf,
        'maskedDestination' => $maskedDestination,
    ]);
}

if ($action === 'apply_reset') {
    $token = trim((string) ($payload['token'] ?? ''));
    $senha = trim((string) ($payload['senha'] ?? ''));
    if ($token === '') {
        pr_json(['ok' => false, 'error' => 'token_invalid'], 400);
    }
    if (!pr_is_access_password_strong($senha)) {
        pr_json(['ok' => false, 'error' => 'invalid_password'], 400);
    }

    $state = pr_load_state($pdo);
    $tokens = is_array($state['passwordResetTokens'] ?? null) ? $state['passwordResetTokens'] : [];
    $match = pr_match_token($tokens, $token);
    if (($match['status'] ?? '') === 'expired') {
        pr_json(['ok' => false, 'error' => 'token_expired'], 400);
    }
    if (($match['status'] ?? '') !== 'valid' || !is_array($match['entry'] ?? null)) {
        pr_json(['ok' => false, 'error' => 'token_invalid'], 400);
    }

    $tokenIndex = (int) $match['index'];
    $entry = $match['entry'];
    $cpf = pr_normalize_cpf($entry['cpf'] ?? '');
    $funcionario = pr_find_funcionario_by_cpf($state, $cpf);
    if (!$funcionario) {
        pr_json(['ok' => false, 'error' => 'colaborador_not_found'], 404);
    }

    $funcionarioId = (string) ($funcionario['id'] ?? '');
    $authList = is_array($state['colaboradoresAuth'] ?? null) ? $state['colaboradoresAuth'] : [];
    $state['colaboradoresAuth'] = pr_upsert_auth_password($authList, $funcionarioId, $cpf, $senha);
    $tokens[$tokenIndex]['usedAt'] = pr_now()->format(DATE_ATOM);
    $state['passwordResetTokens'] = pr_cleanup_tokens($tokens);
    if (!pr_save_state($pdo, $state)) {
        pr_json(['ok' => false, 'error' => 'db_write_failed'], 500);
    }

    pr_json(['ok' => true, 'cpf' => $cpf]);
}

if ($action === 'request_code') {
    $cpf = pr_normalize_cpf($payload['cpf'] ?? '');
    $channel = strtolower(trim((string) ($payload['channel'] ?? 'email')));
    if (strlen($cpf) !== 11) {
        pr_json(['ok' => false, 'error' => 'invalid_cpf'], 400);
    }
    if (!in_array($channel, ['email', 'phone'], true)) {
        pr_json(['ok' => false, 'error' => 'invalid_channel'], 400);
    }

    $state = pr_load_state($pdo);
    $funcionario = pr_find_funcionario_by_cpf($state, $cpf);
    if (!$funcionario) {
        pr_json(['ok' => false, 'error' => 'colaborador_not_found'], 404);
    }

    $nome = trim((string) ($funcionario['nome'] ?? 'Colaborador'));
    $email = pr_normalize_email($funcionario['email'] ?? '');
    $phone = pr_normalize_phone($funcionario['telefone'] ?? '');
    $code = pr_generate_code();
    $maskedDestination = '--';
    $sendResult = ['ok' => false, 'error' => 'send_failed'];

    if ($channel === 'email') {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            pr_json(['ok' => false, 'error' => 'email_not_found'], 400);
        }
        $maskedDestination = pr_mask_email($email);
        $sendResult = pr_send_email_code($email, $nome, $maskedDestination, $code);
    } else {
        if (strlen($phone) < 10) {
            pr_json(['ok' => false, 'error' => 'phone_not_found'], 400);
        }
        $maskedDestination = pr_mask_phone($phone);
        $sendResult = pr_send_phone_code($phone, $nome, $code);
    }

    if (!($sendResult['ok'] ?? false)) {
        if (pr_is_localhost()) {
            $sendResult = ['ok' => true, 'debug' => true];
        } else {
        pr_json(['ok' => false, 'error' => (string) ($sendResult['error'] ?? 'send_failed')], 500);
        }
    }

    $codes = pr_cleanup_codes(is_array($state['passwordResetCodes'] ?? null) ? $state['passwordResetCodes'] : []);
    $codes[] = [
        'id' => 'PRC-' . strtoupper(substr(bin2hex(random_bytes(8)), 0, 12)),
        'cpf' => $cpf,
        'funcionarioId' => (string) ($funcionario['id'] ?? ''),
        'channel' => $channel,
        'codeHash' => password_hash($code, PASSWORD_DEFAULT),
        'createdAt' => pr_now()->format(DATE_ATOM),
        'expiresAt' => pr_now()->modify('+10 minutes')->format(DATE_ATOM),
        'usedAt' => '',
    ];
    $state['passwordResetCodes'] = $codes;
    if (!pr_save_state($pdo, $state)) {
        pr_json(['ok' => false, 'error' => 'db_write_failed'], 500);
    }

    $response = ['ok' => true, 'maskedDestination' => $maskedDestination];
    if (pr_is_localhost() || !empty($sendResult['debug'])) {
        $response['debugCode'] = $code;
    }
    pr_json($response);
}

if ($action === 'apply_code') {
    $cpf = pr_normalize_cpf($payload['cpf'] ?? '');
    $channel = strtolower(trim((string) ($payload['channel'] ?? 'email')));
    $code = preg_replace('/\D+/', '', (string) ($payload['code'] ?? '')) ?: '';
    $senha = trim((string) ($payload['senha'] ?? ''));

    if (strlen($cpf) !== 11) {
        pr_json(['ok' => false, 'error' => 'invalid_cpf'], 400);
    }
    if (!in_array($channel, ['email', 'phone'], true)) {
        pr_json(['ok' => false, 'error' => 'invalid_channel'], 400);
    }
    if (!preg_match('/^\d{6}$/', $code)) {
        pr_json(['ok' => false, 'error' => 'code_invalid'], 400);
    }
    if (!pr_is_access_password_strong($senha)) {
        pr_json(['ok' => false, 'error' => 'invalid_password'], 400);
    }

    $state = pr_load_state($pdo);
    $funcionario = pr_find_funcionario_by_cpf($state, $cpf);
    if (!$funcionario) {
        pr_json(['ok' => false, 'error' => 'colaborador_not_found'], 404);
    }

    $codes = pr_cleanup_codes(is_array($state['passwordResetCodes'] ?? null) ? $state['passwordResetCodes'] : []);
    $matchIndex = null;
    for ($i = count($codes) - 1; $i >= 0; $i -= 1) {
        $entry = $codes[$i];
        if (($entry['cpf'] ?? '') !== $cpf) {
            continue;
        }
        if (($entry['channel'] ?? '') !== $channel) {
            continue;
        }
        if (!password_verify($code, (string) ($entry['codeHash'] ?? ''))) {
            continue;
        }
        $matchIndex = $i;
        break;
    }

    if ($matchIndex === null) {
        $hasOtherChannelCode = false;
        foreach ($codes as $entry) {
            if (($entry['cpf'] ?? '') === $cpf) {
                $hasOtherChannelCode = true;
                if (($entry['channel'] ?? '') !== $channel) {
                    pr_json(['ok' => false, 'error' => 'code_channel_mismatch'], 400);
                }
            }
        }
        pr_json(['ok' => false, 'error' => $hasOtherChannelCode ? 'code_invalid' : 'code_expired'], 400);
    }

    $funcionarioId = (string) ($funcionario['id'] ?? '');
    $authList = is_array($state['colaboradoresAuth'] ?? null) ? $state['colaboradoresAuth'] : [];
    $authIndex = null;
    foreach ($authList as $index => $auth) {
        if (!is_array($auth)) {
            continue;
        }
        if ((string) ($auth['funcionarioId'] ?? '') === $funcionarioId || pr_normalize_cpf($auth['cpf'] ?? '') === $cpf) {
            $authIndex = $index;
            break;
        }
    }
    if ($authIndex === null) {
        $authList[] = [
            'id' => 'COL-' . strtoupper(substr(bin2hex(random_bytes(6)), 0, 10)),
            'funcionarioId' => $funcionarioId,
            'cpf' => $cpf,
            'senha' => $senha,
            'biometriaCredIds' => [],
        ];
    } else {
        $auth = $authList[$authIndex];
        $auth['funcionarioId'] = $funcionarioId;
        $auth['cpf'] = $cpf;
        $auth['senha'] = $senha;
        $authList[$authIndex] = $auth;
    }

    $codes[$matchIndex]['usedAt'] = pr_now()->format(DATE_ATOM);
    $state['passwordResetCodes'] = $codes;
    $state['colaboradoresAuth'] = $authList;
    if (!pr_save_state($pdo, $state)) {
        pr_json(['ok' => false, 'error' => 'db_write_failed'], 500);
    }
    pr_json(['ok' => true]);
}

pr_json(['ok' => false, 'error' => 'invalid_action'], 400);
