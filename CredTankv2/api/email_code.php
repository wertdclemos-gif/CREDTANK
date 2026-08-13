<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

$raw = file_get_contents('php://input') ?: '';
$payload = json_decode($raw, true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_json']);
    exit;
}

$email = strtolower(trim((string) ($payload['email'] ?? '')));
$nome = trim((string) ($payload['nome'] ?? 'Colaborador'));
$code = preg_replace('/\D+/', '', (string) ($payload['code'] ?? ''));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_email']);
    exit;
}

if (!is_string($code) || strlen($code) !== 6) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_code']);
    exit;
}

$host = (string) ($_SERVER['HTTP_HOST'] ?? 'credtank.com');
$host = preg_replace('/:\d+$/', '', $host);
$domain = preg_replace('/^www\./i', '', $host);
$fromEmail = 'noreply@' . ($domain ?: 'credtank.com');

$subject = 'Codigo de confirmacao CredTank';
$message = "Ola {$nome},\n\nSeu codigo de confirmacao CredTank e: {$code}\n\n";
$message .= "O codigo expira em 10 minutos.\n\n";
$message .= "Se voce nao solicitou este codigo, ignore este email.\n";
$headers = [
    'From: CredTank <' . $fromEmail . '>',
    'Reply-To: suporte@' . ($domain ?: 'credtank.com'),
    'Content-Type: text/plain; charset=UTF-8',
];

$sent = @mail($email, $subject, $message, implode("\r\n", $headers));
if (!$sent) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'mail_failed']);
    exit;
}

echo json_encode(['ok' => true]);
