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

function load_app_state(PDO $pdo): ?array
{
    $stmt = $pdo->query('SELECT data FROM app_state WHERE id = 1');
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }
    $decoded = json_decode($row['data'], true);
    return is_array($decoded) ? $decoded : null;
}

function normalize_list($value): array
{
    if (!is_array($value)) {
        return [];
    }
    return array_values(array_filter($value, 'is_array'));
}

function normalize_string_list($value): array
{
    if (!is_array($value)) {
        return [];
    }
    $result = [];
    foreach ($value as $entry) {
        $text = trim((string) $entry);
        if ($text !== '') {
            $result[] = $text;
        }
    }
    return array_values($result);
}

function entry_timestamp(array $item): int
{
    $value = $item['timestamp'] ?? null;
    if (!is_string($value) || $value === '') {
        return 0;
    }
    $ts = strtotime($value);
    return $ts === false ? 0 : $ts;
}

function json_flags(): int
{
    $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
    if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
        $flags |= JSON_INVALID_UTF8_SUBSTITUTE;
    }
    return $flags;
}

function merge_by_id(array $existing, array $incoming): array
{
    $map = [];
    foreach ($existing as $item) {
        $id = $item['id'] ?? null;
        if ($id === null) {
            continue;
        }
        $map[$id] = $item;
    }
    foreach ($incoming as $item) {
        $id = $item['id'] ?? null;
        if ($id === null) {
            continue;
        }
        $map[$id] = $item;
    }
    $merged = array_values($map);
    usort($merged, static function (array $a, array $b): int {
        return entry_timestamp($b) <=> entry_timestamp($a);
    });
    return $merged;
}

function merge_entities_by_id(array $existing, array $incoming): array
{
    $result = [];
    foreach ($existing as $item) {
        if (!is_array($item)) {
            continue;
        }
        $id = (string) ($item['id'] ?? '');
        if ($id === '') {
            continue;
        }
        $result[$id] = $item;
    }
    foreach ($incoming as $item) {
        if (!is_array($item)) {
            continue;
        }
        $id = (string) ($item['id'] ?? '');
        if ($id === '') {
            continue;
        }
        $base = $result[$id] ?? [];
        if (!is_array($base)) {
            $base = [];
        }
        $result[$id] = array_merge($base, $item);
    }
    return array_values($result);
}

function auth_entry_key(array $entry): string
{
    // funcionarioId/CPF sao identidades estaveis; o ID de autenticacao pode
    // ser recriado no primeiro acesso e nao deve produzir credenciais duplicadas.
    $funcionarioId = trim((string) ($entry['funcionarioId'] ?? ''));
    if ($funcionarioId !== '') {
        return 'funcionario:' . $funcionarioId;
    }
    $cpf = normalize_digits($entry['cpf'] ?? '');
    if ($cpf !== '') {
        return 'cpf:' . $cpf;
    }
    $id = trim((string) ($entry['id'] ?? ''));
    if ($id !== '') {
        return 'id:' . $id;
    }
    return '';
}

function merge_auth_entries(array $existing, array $incoming): array
{
    $result = [];
    foreach ($existing as $item) {
        if (!is_array($item)) {
            continue;
        }
        $key = auth_entry_key($item);
        if ($key === '') {
            continue;
        }
        $result[$key] = $item;
    }
    foreach ($incoming as $item) {
        if (!is_array($item)) {
            continue;
        }
        $key = auth_entry_key($item);
        if ($key === '') {
            continue;
        }
        $base = $result[$key] ?? [];
        if (!is_array($base)) {
            $base = [];
        }
        $result[$key] = array_merge($base, $item);
    }
    return array_values($result);
}

function normalize_timestamp($value): string
{
    if ($value instanceof DateTimeInterface) {
        return $value->format(DATE_ATOM);
    }
    if (is_string($value) && $value !== '') {
        try {
            return (new DateTimeImmutable($value))->format(DATE_ATOM);
        } catch (Throwable $e) {
            return (new DateTimeImmutable())->format(DATE_ATOM);
        }
    }
    return (new DateTimeImmutable())->format(DATE_ATOM);
}

function to_mysql_datetime($value): string
{
    if ($value instanceof DateTimeInterface) {
        return $value->format('Y-m-d H:i:s');
    }
    if (is_string($value) && $value !== '') {
        try {
            return (new DateTimeImmutable($value))->format('Y-m-d H:i:s');
        } catch (Throwable $e) {
            return (new DateTimeImmutable())->format('Y-m-d H:i:s');
        }
    }
    return (new DateTimeImmutable())->format('Y-m-d H:i:s');
}

function fetch_transacoes(PDO $pdo): array
{
    $stmt = $pdo->query(
        'SELECT transacao_id, funcionario_id, empresa_id, posto_id, valor, data_hora, payload FROM transacoes ORDER BY data_hora DESC'
    );
    $rows = $stmt->fetchAll();
    if (!$rows) {
        return [];
    }
    $transacoes = [];
    foreach ($rows as $row) {
        $payload = json_decode($row['payload'] ?? '', true);
        if (!is_array($payload)) {
            $payload = [];
        }
        $tx = $payload;
        $tx['id'] = $tx['id'] ?? $row['transacao_id'];
        $tx['funcionarioId'] = $tx['funcionarioId'] ?? $row['funcionario_id'];
        $tx['empresaId'] = $tx['empresaId'] ?? $row['empresa_id'];
        $tx['postoId'] = $tx['postoId'] ?? $row['posto_id'];
        $valor = $tx['valor'] ?? $row['valor'] ?? 0;
        $tx['valor'] = is_numeric($valor) ? (float) $valor : 0.0;
        $tx['timestamp'] = normalize_timestamp($tx['timestamp'] ?? $row['data_hora'] ?? null);
        $transacoes[] = $tx;
    }
    return $transacoes;
}

function persist_transacoes(PDO $pdo, array $transacoes): void
{
    if (!$transacoes) {
        return;
    }
    $stmt = $pdo->prepare(
        'INSERT INTO transacoes (transacao_id, funcionario_id, empresa_id, posto_id, valor, data_hora, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           funcionario_id = VALUES(funcionario_id),
           empresa_id = VALUES(empresa_id),
           posto_id = VALUES(posto_id),
           valor = VALUES(valor),
           data_hora = VALUES(data_hora),
           payload = VALUES(payload)'
    );
    foreach ($transacoes as $tx) {
        if (!is_array($tx)) {
            continue;
        }
        $id = $tx['id'] ?? null;
        if (!is_string($id) || $id === '') {
            continue;
        }
        $funcionarioId = (string) ($tx['funcionarioId'] ?? '');
        $empresaId = (string) ($tx['empresaId'] ?? '');
        $postoId = (string) ($tx['postoId'] ?? '');
        $valor = $tx['valor'] ?? 0;
        $valor = is_numeric($valor) ? (float) $valor : 0.0;
        $dataHora = to_mysql_datetime($tx['timestamp'] ?? null);
        $payload = json_encode($tx, json_flags());
        if ($payload === false) {
            $payload = '{}';
        }
        $stmt->execute([$id, $funcionarioId, $empresaId, $postoId, $valor, $dataHora, $payload]);
    }
}

function replace_transacoes(PDO $pdo, array $transacoes): void
{
    $pdo->beginTransaction();
    try {
        $pdo->exec('DELETE FROM transacoes');
        persist_transacoes($pdo, $transacoes);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function normalize_digits($value): string
{
    return preg_replace('/\D+/', '', (string) $value) ?: '';
}

function tx_empresa_id(array $tx): string
{
    $id = (string) ($tx['empresaId'] ?? '');
    if ($id !== '') {
        return $id;
    }
    return (string) ($tx['empresa_id'] ?? '');
}

function generate_entity_id(string $prefix): string
{
    try {
        return strtoupper($prefix) . '-' . strtoupper(bin2hex(random_bytes(6)));
    } catch (Throwable $e) {
        return strtoupper($prefix) . '-' . strtoupper(str_replace('.', '', uniqid('', true)));
    }
}

function upsert_by_id(array $list, array $item): array
{
    $id = (string) ($item['id'] ?? '');
    if ($id === '') {
        return $list;
    }
    $updated = [];
    $found = false;
    foreach ($list as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        if ((string) ($entry['id'] ?? '') === $id) {
            $updated[] = $item;
            $found = true;
        } else {
            $updated[] = $entry;
        }
    }
    if (!$found) {
        $updated[] = $item;
    }
    return array_values($updated);
}

function normalize_email($value): string
{
    return strtolower(trim((string) $value));
}

function normalize_codigo_maquininha($value): string
{
    return strtoupper(trim((string) $value));
}

function ensure_admin_user_state(array $state): array
{
    $usuarios = normalize_list($state['usuarios'] ?? []);
    foreach ($usuarios as $usuario) {
        if ((string) ($usuario['role'] ?? '') === 'admin') {
            $state['usuarios'] = $usuarios;
            return $state;
        }
    }
    $usuarios[] = [
        'id' => 'U-ADMIN',
        'nome' => 'Administrador',
        'email' => 'admin@credtank.com',
        'senha' => 'admin123',
        'role' => 'admin',
    ];
    $state['usuarios'] = $usuarios;
    return $state;
}

function clean_empresa_payload(array $empresa): array
{
    $id = trim((string) ($empresa['id'] ?? ''));
    if ($id === '') {
        return [];
    }
    $nome = trim((string) ($empresa['nome'] ?? ''));
    if ($nome === '') {
        $nome = 'Empresa';
    }
    $fechamento = trim((string) ($empresa['fechamento'] ?? 'Dia 30'));
    if ($fechamento === '') {
        $fechamento = 'Dia 30';
    }
    $limite = $empresa['limiteMensal'] ?? 500;
    $limite = is_numeric($limite) ? (float) $limite : 500.0;
    $postosConvenio = [];
    foreach (normalize_string_list($empresa['postosConvenio'] ?? []) as $postoId) {
        $value = trim((string) $postoId);
        if ($value !== '') {
            $postosConvenio[] = $value;
        }
    }
    $safe = [
        'id' => $id,
        'nome' => $nome,
        'fechamento' => $fechamento,
        'limiteMensal' => $limite,
        'postosConvenio' => $postosConvenio,
    ];
    $cnpj = trim((string) ($empresa['cnpj'] ?? ''));
    if ($cnpj !== '') {
        $safe['cnpj'] = $cnpj;
    }
    $logoData = (string) ($empresa['logoData'] ?? '');
    if ($logoData !== '' && strlen($logoData) <= 400000) {
        $safe['logoData'] = $logoData;
    }
    return $safe;
}

function clean_empresa_user_payload(array $usuario, string $empresaId): array
{
    $email = normalize_email($usuario['email'] ?? '');
    $senha = trim((string) ($usuario['senha'] ?? ''));
    if ($email === '' || $senha === '') {
        return [];
    }
    $id = trim((string) ($usuario['id'] ?? ''));
    if ($id === '') {
        $id = generate_entity_id('U');
    }
    $nome = trim((string) ($usuario['nome'] ?? ''));
    if ($nome === '') {
        $nome = 'Empresa';
    }
    return [
        'id' => $id,
        'nome' => $nome,
        'email' => $email,
        'senha' => $senha,
        'role' => 'empresa',
        'empresaId' => $empresaId,
    ];
}

function find_empresa_user_in_state(array $usuarios, string $empresaId): ?array
{
    foreach ($usuarios as $usuario) {
        if (!is_array($usuario)) {
            continue;
        }
        if ((string) ($usuario['role'] ?? '') !== 'empresa') {
            continue;
        }
        if ((string) ($usuario['empresaId'] ?? '') !== $empresaId) {
            continue;
        }
        return $usuario;
    }
    return null;
}

function upsert_empresa_registry_entry(PDO $pdo, array $empresa): void
{
    $postosJson = json_encode(normalize_string_list($empresa['postosConvenio'] ?? []), json_flags());
    if ($postosJson === false) {
        $postosJson = '[]';
    }
    $payload = json_encode($empresa, json_flags());
    if ($payload === false) {
        $payload = '{}';
    }
    $stmt = $pdo->prepare(
        'INSERT INTO app_empresas (empresa_id, nome, cnpj, fechamento, limite_mensal, postos_convenio, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           nome = VALUES(nome),
           cnpj = VALUES(cnpj),
           fechamento = VALUES(fechamento),
           limite_mensal = VALUES(limite_mensal),
           postos_convenio = VALUES(postos_convenio),
           payload = VALUES(payload)'
    );
    $stmt->execute([
        (string) $empresa['id'],
        (string) ($empresa['nome'] ?? 'Empresa'),
        isset($empresa['cnpj']) ? (string) $empresa['cnpj'] : null,
        (string) ($empresa['fechamento'] ?? 'Dia 30'),
        is_numeric($empresa['limiteMensal'] ?? null) ? (float) $empresa['limiteMensal'] : 500.0,
        $postosJson,
        $payload,
    ]);
}

function upsert_empresa_user_registry_entry(PDO $pdo, array $usuario): void
{
    $payload = json_encode($usuario, json_flags());
    if ($payload === false) {
        $payload = '{}';
    }
    $stmt = $pdo->prepare(
        'INSERT INTO app_usuarios (user_id, email, role, nome, senha, empresa_id, posto_id, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           email = VALUES(email),
           role = VALUES(role),
           nome = VALUES(nome),
           senha = VALUES(senha),
           empresa_id = VALUES(empresa_id),
           posto_id = VALUES(posto_id),
           payload = VALUES(payload)'
    );
    $stmt->execute([
        (string) $usuario['id'],
        (string) $usuario['email'],
        (string) ($usuario['role'] ?? 'empresa'),
        (string) ($usuario['nome'] ?? 'Empresa'),
        (string) $usuario['senha'],
        (string) ($usuario['empresaId'] ?? ''),
        isset($usuario['postoId']) ? (string) $usuario['postoId'] : null,
        $payload,
    ]);
}

function upsert_credential_registry_entry(PDO $pdo, array $usuario): void
{
    $id = trim((string) ($usuario['id'] ?? ''));
    $role = strtolower(trim((string) ($usuario['role'] ?? '')));
    $senha = trim((string) ($usuario['senha'] ?? ''));
    if ($id === '' || $role === '' || $senha === '') {
        return;
    }
    $cpf = normalize_digits($usuario['cpf'] ?? '');
    $email = normalize_email($usuario['email'] ?? '');
    // A coluna email e obrigatoria nas instalacoes existentes. Para colaborador
    // sem email, uma chave interna deterministica evita colisao entre CPFs.
    if ($email === '') {
        $email = $cpf !== '' ? $cpf . '@colaborador.local' : strtolower($id) . '@usuario.local';
    }
    $payload = json_encode($usuario, json_flags());
    if ($payload === false) {
        $payload = '{}';
    }
    $stmt = $pdo->prepare(
        'INSERT INTO app_usuarios
           (user_id, email, cpf, role, nome, senha, empresa_id, posto_id, funcionario_id, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           email = VALUES(email), cpf = VALUES(cpf), role = VALUES(role),
           nome = VALUES(nome), senha = VALUES(senha), empresa_id = VALUES(empresa_id),
           posto_id = VALUES(posto_id), funcionario_id = VALUES(funcionario_id),
           payload = VALUES(payload)'
    );
    $stmt->execute([
        $id,
        $email,
        $cpf !== '' ? $cpf : null,
        $role,
        (string) ($usuario['nome'] ?? ucfirst($role)),
        $senha,
        isset($usuario['empresaId']) ? (string) $usuario['empresaId'] : null,
        isset($usuario['postoId']) ? (string) $usuario['postoId'] : null,
        isset($usuario['funcionarioId']) ? (string) $usuario['funcionarioId'] : null,
        $payload,
    ]);
}

function sync_credential_registry_from_state(PDO $pdo, array $state): void
{
    foreach (normalize_list($state['usuarios'] ?? []) as $usuario) {
        upsert_credential_registry_entry($pdo, $usuario);
    }
    $funcionarioEmpresas = [];
    foreach (normalize_list($state['funcionarios'] ?? []) as $funcionario) {
        $funcionarioId = (string) ($funcionario['id'] ?? '');
        if ($funcionarioId !== '') {
            $funcionarioEmpresas[$funcionarioId] = (string) ($funcionario['empresaId'] ?? '');
        }
    }
    foreach (normalize_list($state['colaboradoresAuth'] ?? []) as $auth) {
        $auth['role'] = 'funcionario';
        if (empty($auth['id'])) {
            $auth['id'] = 'COL-' . (string) ($auth['funcionarioId'] ?? normalize_digits($auth['cpf'] ?? ''));
        }
        $funcionarioId = (string) ($auth['funcionarioId'] ?? '');
        if ($funcionarioId !== '' && isset($funcionarioEmpresas[$funcionarioId])) {
            $auth['empresaId'] = $funcionarioEmpresas[$funcionarioId];
        }
        upsert_credential_registry_entry($pdo, $auth);
    }
}

function load_credential_registry(PDO $pdo): array
{
    $usuarios = [];
    $colaboradoresAuth = [];
    $stmt = $pdo->query(
        'SELECT user_id, email, cpf, role, nome, senha, empresa_id, posto_id, funcionario_id, payload
           FROM app_usuarios ORDER BY updated_at ASC, user_id ASC'
    );
    foreach ($stmt->fetchAll() ?: [] as $row) {
        $item = json_decode((string) ($row['payload'] ?? ''), true);
        if (!is_array($item)) {
            $item = [];
        }
        $item['id'] = (string) ($row['user_id'] ?? $item['id'] ?? '');
        $item['role'] = (string) ($row['role'] ?? $item['role'] ?? '');
        $item['nome'] = (string) ($row['nome'] ?? $item['nome'] ?? '');
        $item['senha'] = (string) ($row['senha'] ?? $item['senha'] ?? '');
        $role = (string) $item['role'];
        if ($role === 'funcionario') {
            $item['cpf'] = normalize_digits($row['cpf'] ?? $item['cpf'] ?? '');
            $item['funcionarioId'] = (string) ($row['funcionario_id'] ?? $item['funcionarioId'] ?? '');
            unset($item['role'], $item['nome']);
            if ($item['cpf'] !== '' && $item['funcionarioId'] !== '') {
                $colaboradoresAuth[] = $item;
            }
            continue;
        }
        $dbEmail = normalize_email($row['email'] ?? '');
        if ($dbEmail !== '' && !str_ends_with($dbEmail, '@usuario.local')) {
            $item['email'] = $dbEmail;
        }
        if (!empty($row['empresa_id'])) {
            $item['empresaId'] = (string) $row['empresa_id'];
        }
        if (!empty($row['posto_id'])) {
            $item['postoId'] = (string) $row['posto_id'];
        }
        if ($item['id'] !== '') {
            $usuarios[] = $item;
        }
    }
    return ['usuarios' => $usuarios, 'colaboradoresAuth' => $colaboradoresAuth];
}

function apply_credential_registry_to_state(array $state, array $registry): array
{
    $state['usuarios'] = merge_entities_by_id(
        normalize_list($state['usuarios'] ?? []),
        normalize_list($registry['usuarios'] ?? [])
    );
    $state['colaboradoresAuth'] = merge_auth_entries(
        normalize_list($state['colaboradoresAuth'] ?? []),
        normalize_list($registry['colaboradoresAuth'] ?? [])
    );
    return $state;
}

function delete_empresa_user_registry_by_empresa(PDO $pdo, string $empresaId): void
{
    $stmt = $pdo->prepare("DELETE FROM app_usuarios WHERE role = 'empresa' AND empresa_id = ?");
    $stmt->execute([$empresaId]);
}

function delete_empresa_registry_by_id(PDO $pdo, string $empresaId): void
{
    $stmt = $pdo->prepare('DELETE FROM app_empresas WHERE empresa_id = ?');
    $stmt->execute([$empresaId]);
}

function load_empresa_registry(PDO $pdo): array
{
    try {
        $empresas = [];
        $usuarios = [];

        $stmt = $pdo->query('SELECT empresa_id, nome, cnpj, fechamento, limite_mensal, postos_convenio, payload FROM app_empresas');
        $rows = $stmt->fetchAll();
        foreach ($rows as $row) {
            $payload = json_decode((string) ($row['payload'] ?? ''), true);
            if (!is_array($payload)) {
                $payload = [
                    'id' => (string) ($row['empresa_id'] ?? ''),
                    'nome' => (string) ($row['nome'] ?? ''),
                    'cnpj' => (string) ($row['cnpj'] ?? ''),
                    'fechamento' => (string) ($row['fechamento'] ?? ''),
                    'limiteMensal' => is_numeric($row['limite_mensal'] ?? null) ? (float) $row['limite_mensal'] : 500.0,
                ];
                $postos = json_decode((string) ($row['postos_convenio'] ?? '[]'), true);
                $payload['postosConvenio'] = is_array($postos) ? array_values(array_map('strval', $postos)) : [];
            }
            $clean = clean_empresa_payload($payload);
            if ($clean) {
                $empresas[] = $clean;
            }
        }

        $stmt = $pdo->query("SELECT user_id, email, role, nome, senha, empresa_id, posto_id, payload FROM app_usuarios WHERE role = 'empresa'");
        $rows = $stmt->fetchAll();
        foreach ($rows as $row) {
            $payload = json_decode((string) ($row['payload'] ?? ''), true);
            if (!is_array($payload)) {
                $payload = [
                    'id' => (string) ($row['user_id'] ?? ''),
                    'nome' => (string) ($row['nome'] ?? ''),
                    'email' => (string) ($row['email'] ?? ''),
                    'senha' => (string) ($row['senha'] ?? ''),
                    'role' => 'empresa',
                    'empresaId' => (string) ($row['empresa_id'] ?? ''),
                ];
            }
            $empresaId = (string) ($payload['empresaId'] ?? $row['empresa_id'] ?? '');
            if ($empresaId === '') {
                continue;
            }
            $clean = clean_empresa_user_payload($payload, $empresaId);
            if ($clean) {
                $usuarios[] = $clean;
            }
        }

        return ['ok' => true, 'empresas' => $empresas, 'usuarios' => $usuarios];
    } catch (Throwable $e) {
        return ['ok' => false, 'empresas' => [], 'usuarios' => []];
    }
}

function apply_empresa_registry_to_state(array $state, array $registry): array
{
    if (!($registry['ok'] ?? false)) {
        return $state;
    }

    // Compatibilidade com o banco existente: a tabela auxiliar complementa o
    // app_state, mas nunca apaga uma empresa que ainda exista no estado legado.
    $stateEmpresas = normalize_list($state['empresas'] ?? []);
    $registryEmpresas = normalize_list($registry['empresas'] ?? []);
    $state['empresas'] = merge_entities_by_id($stateEmpresas, $registryEmpresas);

    $nonEmpresaUsers = [];
    $stateEmpresaUsers = [];
    foreach (normalize_list($state['usuarios'] ?? []) as $usuario) {
        if ((string) ($usuario['role'] ?? '') === 'empresa') {
            $stateEmpresaUsers[] = $usuario;
        } else {
            $nonEmpresaUsers[] = $usuario;
        }
    }
    $empresaUsers = merge_entities_by_id($stateEmpresaUsers, normalize_list($registry['usuarios'] ?? []));
    $state['usuarios'] = array_values(array_merge($nonEmpresaUsers, $empresaUsers));
    return $state;
}

function clean_funcionario_payload(array $funcionario): array
{
    $id = trim((string) ($funcionario['id'] ?? ''));
    if ($id === '') {
        return [];
    }

    $empresaId = trim((string) ($funcionario['empresaId'] ?? ''));
    $nome = trim((string) ($funcionario['nome'] ?? ''));
    if ($nome === '') {
        $nome = 'Funcionario';
    }
    $matricula = trim((string) ($funcionario['matricula'] ?? ''));
    $ativoRaw = $funcionario['ativo'] ?? true;
    $ativo = !($ativoRaw === false || $ativoRaw === 0 || $ativoRaw === '0' || $ativoRaw === 'false');

    $safe = [
        'id' => $id,
        'nome' => $nome,
        'matricula' => $matricula,
        'empresaId' => $empresaId,
        'ativo' => $ativo,
    ];

    $cpf = trim((string) ($funcionario['cpf'] ?? ''));
    if ($cpf !== '') {
        $safe['cpf'] = $cpf;
    }
    $email = normalize_email($funcionario['email'] ?? '');
    if ($email !== '') {
        $safe['email'] = $email;
    }
    $telefone = trim((string) ($funcionario['telefone'] ?? ''));
    if ($telefone !== '') {
        $safe['telefone'] = $telefone;
    }
    $localidade = trim((string) ($funcionario['localidade'] ?? ''));
    if ($localidade !== '') {
        $safe['localidade'] = substr($localidade, 0, 190);
    }
    $salario = $funcionario['salario'] ?? null;
    if (is_numeric($salario)) {
        $safe['salario'] = (float) $salario;
    }
    $fotoData = (string) ($funcionario['fotoData'] ?? '');
    if ($fotoData !== '' && strlen($fotoData) <= 700000 && preg_match('/^data:image\//', $fotoData)) {
        $safe['fotoData'] = $fotoData;
    }

    return $safe;
}

function upsert_funcionario_registry_entry(PDO $pdo, array $funcionario): void
{
    $payload = json_encode($funcionario, json_flags());
    if ($payload === false) {
        $payload = '{}';
    }
    $fotoData = array_key_exists('fotoData', $funcionario) ? (string) $funcionario['fotoData'] : null;
    $stmt = $pdo->prepare(
        'INSERT INTO app_funcionarios (funcionario_id, empresa_id, nome, cpf, matricula, localidade, foto_data, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           empresa_id = VALUES(empresa_id),
           nome = VALUES(nome),
           cpf = VALUES(cpf),
           matricula = VALUES(matricula),
           localidade = VALUES(localidade),
           foto_data = COALESCE(VALUES(foto_data), foto_data),
           payload = VALUES(payload)'
    );
    $stmt->execute([
        (string) $funcionario['id'],
        (string) ($funcionario['empresaId'] ?? ''),
        (string) ($funcionario['nome'] ?? 'Funcionario'),
        isset($funcionario['cpf']) ? (string) $funcionario['cpf'] : null,
        isset($funcionario['matricula']) ? (string) $funcionario['matricula'] : null,
        isset($funcionario['localidade']) ? (string) $funcionario['localidade'] : null,
        $fotoData,
        $payload,
    ]);
}

function sync_funcionario_registry_from_state(PDO $pdo, array $state, bool $cleanup = false): void
{
    $funcionarios = normalize_list($state['funcionarios'] ?? []);
    $ids = [];

    foreach ($funcionarios as $funcionarioRaw) {
        $funcionario = clean_funcionario_payload($funcionarioRaw);
        if (!$funcionario) {
            continue;
        }
        $ids[] = $funcionario['id'];
        upsert_funcionario_registry_entry($pdo, $funcionario);
    }

    if (!$cleanup) {
        return;
    }
    if (!$ids) {
        $pdo->exec('DELETE FROM app_funcionarios');
        return;
    }
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare("DELETE FROM app_funcionarios WHERE funcionario_id NOT IN ($placeholders)");
    $stmt->execute($ids);
}

function delete_funcionario_registry_by_empresa(PDO $pdo, string $empresaId): void
{
    $stmt = $pdo->prepare('DELETE FROM app_funcionarios WHERE empresa_id = ?');
    $stmt->execute([$empresaId]);
}

function delete_funcionario_registry_by_id(PDO $pdo, string $funcionarioId): void
{
    $stmt = $pdo->prepare('DELETE FROM app_funcionarios WHERE funcionario_id = ?');
    $stmt->execute([$funcionarioId]);
    $stmt = $pdo->prepare("DELETE FROM app_usuarios WHERE role = 'funcionario' AND funcionario_id = ?");
    $stmt->execute([$funcionarioId]);
}

function delete_funcionario_credentials_by_empresa(PDO $pdo, string $empresaId): void
{
    $stmt = $pdo->prepare("DELETE FROM app_usuarios WHERE role = 'funcionario' AND empresa_id = ?");
    $stmt->execute([$empresaId]);
}

function load_funcionario_registry(PDO $pdo): array
{
    try {
        $funcionarios = [];
        $stmt = $pdo->query(
            'SELECT funcionario_id, empresa_id, nome, cpf, matricula, localidade, foto_data, payload FROM app_funcionarios'
        );
        $rows = $stmt->fetchAll();
        foreach ($rows as $row) {
            $payload = json_decode((string) ($row['payload'] ?? ''), true);
            if (!is_array($payload)) {
                $payload = [
                    'id' => (string) ($row['funcionario_id'] ?? ''),
                    'empresaId' => (string) ($row['empresa_id'] ?? ''),
                    'nome' => (string) ($row['nome'] ?? ''),
                    'cpf' => (string) ($row['cpf'] ?? ''),
                    'matricula' => (string) ($row['matricula'] ?? ''),
                    'localidade' => (string) ($row['localidade'] ?? ''),
                ];
            }
            $fotoData = (string) ($row['foto_data'] ?? '');
            if ($fotoData !== '' && !isset($payload['fotoData'])) {
                $payload['fotoData'] = $fotoData;
            }
            if (!isset($payload['localidade']) && trim((string) ($row['localidade'] ?? '')) !== '') {
                $payload['localidade'] = (string) $row['localidade'];
            }
            $clean = clean_funcionario_payload($payload);
            if ($clean) {
                $funcionarios[] = $clean;
            }
        }
        return ['ok' => true, 'funcionarios' => $funcionarios];
    } catch (Throwable $e) {
        return ['ok' => false, 'funcionarios' => []];
    }
}

function apply_funcionario_registry_to_state(array $state, array $registry): array
{
    if (!($registry['ok'] ?? false)) {
        return $state;
    }

    $map = [];
    $order = [];
    foreach (normalize_list($state['funcionarios'] ?? []) as $funcionario) {
        $id = (string) ($funcionario['id'] ?? '');
        if ($id === '') {
            continue;
        }
        $map[$id] = $funcionario;
        $order[] = $id;
    }

    foreach (normalize_list($registry['funcionarios'] ?? []) as $funcionario) {
        $id = (string) ($funcionario['id'] ?? '');
        if ($id === '') {
            continue;
        }
        if (!isset($map[$id])) {
            $order[] = $id;
            $map[$id] = [];
        }
        $map[$id] = array_merge($map[$id], $funcionario);
    }

    $merged = [];
    foreach (array_values(array_unique($order)) as $id) {
        if (isset($map[$id])) {
            $merged[] = $map[$id];
        }
    }
    $state['funcionarios'] = $merged;
    return $state;
}

function sync_empresa_registry_from_state(PDO $pdo, array $state, bool $cleanup = false): void
{
    $empresas = normalize_list($state['empresas'] ?? []);
    $usuarios = normalize_list($state['usuarios'] ?? []);
    $empresaIds = [];

    foreach ($empresas as $empresaRaw) {
        $empresa = clean_empresa_payload($empresaRaw);
        if (!$empresa) {
            continue;
        }
        $empresaIds[] = $empresa['id'];
        upsert_empresa_registry_entry($pdo, $empresa);

        $userRaw = find_empresa_user_in_state($usuarios, $empresa['id']);
        if ($userRaw) {
            $user = clean_empresa_user_payload($userRaw, $empresa['id']);
            if ($user) {
                upsert_empresa_user_registry_entry($pdo, $user);
            } else {
                delete_empresa_user_registry_by_empresa($pdo, $empresa['id']);
            }
        } else {
            delete_empresa_user_registry_by_empresa($pdo, $empresa['id']);
        }
    }

    // app_usuarios e a fonte relacional de todas as credenciais, nao apenas
    // das contas de empresa.
    sync_credential_registry_from_state($pdo, $state);

    if (!$cleanup) {
        return;
    }
    if (!$empresaIds) {
        $pdo->exec('DELETE FROM app_empresas');
        $pdo->exec("DELETE FROM app_usuarios WHERE role = 'empresa'");
        return;
    }
    $placeholders = implode(',', array_fill(0, count($empresaIds), '?'));
    $stmt = $pdo->prepare("DELETE FROM app_empresas WHERE empresa_id NOT IN ($placeholders)");
    $stmt->execute($empresaIds);
    $stmt = $pdo->prepare("DELETE FROM app_usuarios WHERE role = 'empresa' AND empresa_id NOT IN ($placeholders)");
    $stmt->execute($empresaIds);
}

function delete_empresa_state(array $state, string $empresaId): array
{
    $empresas = normalize_list($state['empresas'] ?? []);
    $funcionarios = normalize_list($state['funcionarios'] ?? []);
    $usuarios = normalize_list($state['usuarios'] ?? []);
    $authList = normalize_list($state['colaboradoresAuth'] ?? []);
    $transacoes = normalize_list($state['transacoes'] ?? []);

    $empresaExists = false;
    foreach ($empresas as $empresa) {
        if ((string) ($empresa['id'] ?? '') === $empresaId) {
            $empresaExists = true;
            break;
        }
    }

    $funcionarioIds = [];
    $funcionarioCpfs = [];
    foreach ($funcionarios as $funcionario) {
        if ((string) ($funcionario['empresaId'] ?? '') !== $empresaId) {
            continue;
        }
        $id = (string) ($funcionario['id'] ?? '');
        if ($id !== '') {
            $funcionarioIds[$id] = true;
        }
        $cpf = normalize_digits($funcionario['cpf'] ?? '');
        if ($cpf !== '') {
            $funcionarioCpfs[$cpf] = true;
        }
    }

    $state['empresas'] = array_values(array_filter(
        $empresas,
        static function (array $empresa) use ($empresaId): bool {
            return (string) ($empresa['id'] ?? '') !== $empresaId;
        }
    ));
    $state['funcionarios'] = array_values(array_filter(
        $funcionarios,
        static function (array $funcionario) use ($empresaId): bool {
            return (string) ($funcionario['empresaId'] ?? '') !== $empresaId;
        }
    ));
    $state['usuarios'] = array_values(array_filter(
        $usuarios,
        static function (array $usuario) use ($empresaId, $funcionarioIds, $funcionarioCpfs): bool {
            if ((string) ($usuario['role'] ?? '') === 'empresa' && (string) ($usuario['empresaId'] ?? '') === $empresaId) {
                return false;
            }
            if ((string) ($usuario['role'] ?? '') === 'funcionario') {
                $funcionarioId = (string) ($usuario['funcionarioId'] ?? '');
                if ($funcionarioId !== '' && isset($funcionarioIds[$funcionarioId])) {
                    return false;
                }
                $cpf = normalize_digits($usuario['cpf'] ?? '');
                if ($cpf !== '' && isset($funcionarioCpfs[$cpf])) {
                    return false;
                }
            }
            return true;
        }
    ));
    $state['colaboradoresAuth'] = array_values(array_filter(
        $authList,
        static function (array $auth) use ($funcionarioIds, $funcionarioCpfs): bool {
            $funcionarioId = (string) ($auth['funcionarioId'] ?? '');
            if ($funcionarioId !== '' && isset($funcionarioIds[$funcionarioId])) {
                return false;
            }
            $cpf = normalize_digits($auth['cpf'] ?? '');
            if ($cpf !== '' && isset($funcionarioCpfs[$cpf])) {
                return false;
            }
            return true;
        }
    ));
    $state['transacoes'] = array_values(array_filter(
        $transacoes,
        static function (array $tx) use ($empresaId): bool {
            return tx_empresa_id($tx) !== $empresaId;
        }
    ));

    if (isset($state['passwordResetTokens']) && is_array($state['passwordResetTokens'])) {
        $state['passwordResetTokens'] = array_values(array_filter(
            $state['passwordResetTokens'],
            static function ($entry) use ($funcionarioIds, $funcionarioCpfs): bool {
                if (!is_array($entry)) {
                    return false;
                }
                $funcionarioId = (string) ($entry['funcionarioId'] ?? '');
                if ($funcionarioId !== '' && isset($funcionarioIds[$funcionarioId])) {
                    return false;
                }
                $cpf = normalize_digits($entry['cpf'] ?? '');
                if ($cpf !== '' && isset($funcionarioCpfs[$cpf])) {
                    return false;
                }
                return true;
            }
        ));
    }
    if (isset($state['passwordResetCodes']) && is_array($state['passwordResetCodes'])) {
        $state['passwordResetCodes'] = array_values(array_filter(
            $state['passwordResetCodes'],
            static function ($entry) use ($funcionarioIds, $funcionarioCpfs): bool {
                if (!is_array($entry)) {
                    return false;
                }
                $funcionarioId = (string) ($entry['funcionarioId'] ?? '');
                if ($funcionarioId !== '' && isset($funcionarioIds[$funcionarioId])) {
                    return false;
                }
                $cpf = normalize_digits($entry['cpf'] ?? '');
                if ($cpf !== '' && isset($funcionarioCpfs[$cpf])) {
                    return false;
                }
                return true;
            }
        ));
    }

    return ['state' => $state, 'deleted' => $empresaExists];
}

function delete_funcionario_state(array $state, string $funcionarioId): array
{
    $funcionarios = normalize_list($state['funcionarios'] ?? []);
    $usuarios = normalize_list($state['usuarios'] ?? []);
    $authList = normalize_list($state['colaboradoresAuth'] ?? []);
    $transacoes = normalize_list($state['transacoes'] ?? []);

    $target = null;
    foreach ($funcionarios as $funcionario) {
        if ((string) ($funcionario['id'] ?? '') === $funcionarioId) {
            $target = $funcionario;
            break;
        }
    }
    if (!$target) {
        return ['state' => $state, 'deleted' => false];
    }

    $cpf = normalize_digits($target['cpf'] ?? '');
    $state['funcionarios'] = array_values(array_filter(
        $funcionarios,
        static function (array $funcionario) use ($funcionarioId): bool {
            return (string) ($funcionario['id'] ?? '') !== $funcionarioId;
        }
    ));
    $state['usuarios'] = array_values(array_filter(
        $usuarios,
        static function (array $usuario) use ($funcionarioId, $cpf): bool {
            if ((string) ($usuario['funcionarioId'] ?? '') === $funcionarioId) {
                return false;
            }
            $usuarioCpf = normalize_digits($usuario['cpf'] ?? '');
            if ($cpf !== '' && $usuarioCpf !== '' && $usuarioCpf === $cpf) {
                return false;
            }
            return true;
        }
    ));
    $state['colaboradoresAuth'] = array_values(array_filter(
        $authList,
        static function (array $auth) use ($funcionarioId, $cpf): bool {
            if ((string) ($auth['funcionarioId'] ?? '') === $funcionarioId) {
                return false;
            }
            $authCpf = normalize_digits($auth['cpf'] ?? '');
            if ($cpf !== '' && $authCpf !== '' && $authCpf === $cpf) {
                return false;
            }
            return true;
        }
    ));
    // Mantem o historico financeiro/auditoria mesmo apos excluir o cadastro.
    $state['transacoes'] = $transacoes;

    foreach (['passwordResetTokens', 'passwordResetCodes'] as $key) {
        if (!isset($state[$key]) || !is_array($state[$key])) {
            continue;
        }
        $state[$key] = array_values(array_filter(
            $state[$key],
            static function ($entry) use ($funcionarioId, $cpf): bool {
                if (!is_array($entry)) {
                    return false;
                }
                if ((string) ($entry['funcionarioId'] ?? '') === $funcionarioId) {
                    return false;
                }
                $entryCpf = normalize_digits($entry['cpf'] ?? '');
                if ($cpf !== '' && $entryCpf !== '' && $entryCpf === $cpf) {
                    return false;
                }
                return true;
            }
        ));
    }

    return ['state' => $state, 'deleted' => true, 'funcionario' => $target];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $pendingFor = $_GET['pending_for'] ?? '';
    if (is_string($pendingFor) && $pendingFor !== '') {
        $pending = null;
        $state = load_app_state($pdo) ?? [];
        $transacoes = normalize_list($state['transacoes'] ?? []);
        usort($transacoes, static function (array $a, array $b): int {
            return entry_timestamp($b) <=> entry_timestamp($a);
        });
        foreach ($transacoes as $tx) {
            if (!is_array($tx)) {
                continue;
            }
            $funcionarioId = (string) ($tx['funcionarioId'] ?? $tx['funcionario_id'] ?? '');
            if ($funcionarioId !== (string) $pendingFor) {
                continue;
            }
            if (($tx['status'] ?? '') === 'pendente_confirmacao') {
                $pending = $tx;
                break;
            }
        }
        echo json_encode(['ok' => true, 'pending' => $pending]);
        exit;
    }
    $state = load_app_state($pdo);
    if ($state === null) {
        $state = [];
    }
    if (!isset($state['transacoes']) || !is_array($state['transacoes'])) {
        $transacoes = fetch_transacoes($pdo);
        if ($transacoes) {
            $state['transacoes'] = $transacoes;
        }
    }
    $registry = load_empresa_registry($pdo);
    if (($registry['ok'] ?? false) && !normalize_list($registry['empresas'] ?? []) && normalize_list($state['empresas'] ?? [])) {
        try {
            sync_empresa_registry_from_state($pdo, $state, false);
            $registry = load_empresa_registry($pdo);
        } catch (Throwable $e) {
        }
    }
    $state = apply_empresa_registry_to_state($state, $registry);
    $funcionarioRegistry = load_funcionario_registry($pdo);
    if (
        ($funcionarioRegistry['ok'] ?? false) &&
        !normalize_list($funcionarioRegistry['funcionarios'] ?? []) &&
        normalize_list($state['funcionarios'] ?? [])
    ) {
        try {
            sync_funcionario_registry_from_state($pdo, $state, true);
            $funcionarioRegistry = load_funcionario_registry($pdo);
        } catch (Throwable $e) {
        }
    }
    $state = apply_funcionario_registry_to_state($state, $funcionarioRegistry);
    $state = ensure_admin_user_state($state);
    try {
        sync_credential_registry_from_state($pdo, $state);
        $state = apply_credential_registry_to_state($state, load_credential_registry($pdo));
    } catch (Throwable $e) {
        // Mantem compatibilidade durante uma migracao incompleta do banco.
    }
    echo json_encode(['ok' => true, 'data' => $state]);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input') ?: '';
    $decoded = json_decode($raw, true);
    if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid_json']);
        exit;
    }
    $incoming = is_array($decoded) ? $decoded : [];
    $current = load_app_state($pdo) ?? [];
    if (!is_array($current)) {
        $current = [];
    }
    // Sempre recupera empresas/funcionarios das tabelas persistentes antes de
    // aceitar um snapshot do navegador. Assim uma tela vazia nunca vira fonte
    // de verdade sobre o banco da hospedagem.
    $current = apply_empresa_registry_to_state($current, load_empresa_registry($pdo));
    $current = apply_funcionario_registry_to_state($current, load_funcionario_registry($pdo));
    try {
        $current = apply_credential_registry_to_state($current, load_credential_registry($pdo));
    } catch (Throwable $e) {
    }
    if (!is_array($incoming)) {
        $incoming = [];
    }

    $action = strtolower(trim((string) ($incoming['action'] ?? '')));
    if ($action === 'add_empresa') {
        $nome = trim((string) ($incoming['nome'] ?? ''));
        if ($nome === '') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_nome']);
            exit;
        }

        $loginEmail = normalize_email($incoming['loginEmail'] ?? '');
        $loginSenha = trim((string) ($incoming['loginSenha'] ?? ''));
        if (($loginEmail !== '' && $loginSenha === '') || ($loginEmail === '' && $loginSenha !== '')) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_login_pair']);
            exit;
        }

        $currentState = load_app_state($pdo) ?? [];
        if (!is_array($currentState)) {
            $currentState = [];
        }
        $currentState['empresas'] = normalize_list($currentState['empresas'] ?? []);
        $currentState['postos'] = normalize_list($currentState['postos'] ?? []);
        $currentState['usuarios'] = normalize_list($currentState['usuarios'] ?? []);
        $currentState['funcionarios'] = normalize_list($currentState['funcionarios'] ?? []);
        $currentState['colaboradoresAuth'] = normalize_list($currentState['colaboradoresAuth'] ?? []);
        $currentState['transacoes'] = normalize_list($currentState['transacoes'] ?? []);
        $currentState['logs'] = normalize_list($currentState['logs'] ?? []);

        if ($loginEmail !== '') {
            foreach ($currentState['usuarios'] as $usuario) {
                if (!is_array($usuario)) {
                    continue;
                }
                if (normalize_email($usuario['email'] ?? '') === $loginEmail) {
                    http_response_code(409);
                    echo json_encode(['ok' => false, 'error' => 'email_in_use']);
                    exit;
                }
            }
            $registryCheck = load_empresa_registry($pdo);
            if ($registryCheck['ok'] ?? false) {
                foreach (normalize_list($registryCheck['usuarios'] ?? []) as $usuario) {
                    if (!is_array($usuario)) {
                        continue;
                    }
                    if (normalize_email($usuario['email'] ?? '') === $loginEmail) {
                        http_response_code(409);
                        echo json_encode(['ok' => false, 'error' => 'email_in_use']);
                        exit;
                    }
                }
            }
        }

        $empresaId = trim((string) ($incoming['empresaId'] ?? ''));
        if ($empresaId === '') {
            $empresaId = generate_entity_id('E');
        }
        $fechamento = trim((string) ($incoming['fechamento'] ?? ''));
        if ($fechamento === '') {
            $fechamento = 'Dia 30';
        }
        $limitePadrao = $currentState['limitePadrao'] ?? 500;
        $limitePadrao = is_numeric($limitePadrao) ? (float) $limitePadrao : 500.0;
        $postosConvenio = [];
        foreach ($currentState['postos'] as $posto) {
            $postoId = (string) ($posto['id'] ?? '');
            if ($postoId !== '') {
                $postosConvenio[] = $postoId;
            }
        }

        $empresa = [
            'id' => $empresaId,
            'nome' => $nome,
            'fechamento' => $fechamento,
            'limiteMensal' => $limitePadrao,
            'postosConvenio' => $postosConvenio,
        ];
        $cnpj = trim((string) ($incoming['cnpj'] ?? ''));
        if ($cnpj !== '') {
            $empresa['cnpj'] = $cnpj;
        }

        $currentState['empresas'] = upsert_by_id($currentState['empresas'], $empresa);

        $empresaUser = null;
        if ($loginEmail !== '' && $loginSenha !== '') {
            $userId = trim((string) ($incoming['userId'] ?? ''));
            if ($userId === '') {
                $userId = generate_entity_id('U');
            }
            $empresaUser = [
                'id' => $userId,
                'nome' => $nome,
                'email' => $loginEmail,
                'senha' => $loginSenha,
                'role' => 'empresa',
                'empresaId' => $empresaId,
            ];
            $currentState['usuarios'] = upsert_by_id($currentState['usuarios'], $empresaUser);
        }

        try {
            $empresaClean = clean_empresa_payload($empresa);
            if (!$empresaClean) {
                throw new RuntimeException('invalid_empresa_payload');
            }
            upsert_empresa_registry_entry($pdo, $empresaClean);
            if ($empresaUser) {
                $userClean = clean_empresa_user_payload($empresaUser, $empresaId);
                if (!$userClean) {
                    throw new RuntimeException('invalid_user_payload');
                }
                upsert_empresa_user_registry_entry($pdo, $userClean);
            } else {
                delete_empresa_user_registry_by_empresa($pdo, $empresaId);
            }
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'db_write_failed']);
            exit;
        }

        try {
            replace_transacoes($pdo, $currentState['transacoes']);
        } catch (Throwable $e) {
            try {
                ensure_tables($pdo);
                replace_transacoes($pdo, $currentState['transacoes']);
            } catch (Throwable $e2) {
            }
        }

        $currentState = ensure_admin_user_state($currentState);
        $payload = json_encode($currentState, json_flags());
        if ($payload === false) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'db_encode_failed']);
            exit;
        }
        $stateSaved = true;
        $stmt = $pdo->prepare(
            'INSERT INTO app_state (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)'
        );
        try {
            $stmt->execute([$payload]);
        } catch (Throwable $e) {
            $stateSaved = false;
        }

        try {
            sync_empresa_registry_from_state($pdo, $currentState, false);
        } catch (Throwable $e) {
        }

        $currentState = apply_empresa_registry_to_state($currentState, load_empresa_registry($pdo));
        $currentState = apply_funcionario_registry_to_state($currentState, load_funcionario_registry($pdo));
        $currentState = ensure_admin_user_state($currentState);
        echo json_encode([
            'ok' => true,
            'data' => $currentState,
            'empresaId' => $empresaId,
            'warning' => $stateSaved ? '' : 'state_write_failed',
        ]);
        exit;
    }

    if ($action === 'add_posto') {
        $codigoMaquininha = normalize_codigo_maquininha($incoming['codigoMaquininha'] ?? '');
        if ($codigoMaquininha === '') {
            $codigoMaquininha = normalize_codigo_maquininha(generate_entity_id('MQ'));
        }

        $codigoAcesso = trim((string) ($incoming['codigoAcesso'] ?? ''));
        if ($codigoAcesso === '' || strlen($codigoAcesso) < 4) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_codigo_acesso']);
            exit;
        }

        $nome = trim((string) ($incoming['nome'] ?? ''));
        if ($nome === '') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_nome']);
            exit;
        }

        $loginEmail = normalize_email($incoming['loginEmail'] ?? '');
        $loginSenha = trim((string) ($incoming['loginSenha'] ?? ''));
        if (($loginEmail !== '' && $loginSenha === '') || ($loginEmail === '' && $loginSenha !== '')) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_login_pair']);
            exit;
        }

        $currentState = load_app_state($pdo) ?? [];
        if (!is_array($currentState)) {
            $currentState = [];
        }
        $currentState['empresas'] = normalize_list($currentState['empresas'] ?? []);
        $currentState['postos'] = normalize_list($currentState['postos'] ?? []);
        $currentState['usuarios'] = normalize_list($currentState['usuarios'] ?? []);
        $currentState['funcionarios'] = normalize_list($currentState['funcionarios'] ?? []);
        $currentState['colaboradoresAuth'] = normalize_list($currentState['colaboradoresAuth'] ?? []);
        $currentState['transacoes'] = normalize_list($currentState['transacoes'] ?? []);
        $currentState['logs'] = normalize_list($currentState['logs'] ?? []);

        $postoId = trim((string) ($incoming['postoId'] ?? ''));
        if ($postoId === '') {
            $postoId = generate_entity_id('P');
        }

        $existingPostoUser = null;
        foreach ($currentState['usuarios'] as $usuario) {
            if (!is_array($usuario)) {
                continue;
            }
            if ((string) ($usuario['role'] ?? '') === 'posto' && (string) ($usuario['postoId'] ?? '') === $postoId) {
                $existingPostoUser = $usuario;
                break;
            }
        }

        foreach ($currentState['postos'] as $posto) {
            if (!is_array($posto)) {
                continue;
            }
            $existingCodigo = normalize_codigo_maquininha($posto['codigoMaquininha'] ?? '');
            if ($existingCodigo === '') {
                continue;
            }
            $existingId = (string) ($posto['id'] ?? '');
            if ($existingCodigo === $codigoMaquininha && $existingId !== $postoId) {
                http_response_code(409);
                echo json_encode(['ok' => false, 'error' => 'duplicate_codigo_maquininha']);
                exit;
            }
        }

        if ($loginEmail !== '') {
            foreach ($currentState['usuarios'] as $usuario) {
                if (!is_array($usuario)) {
                    continue;
                }
                $usuarioEmail = normalize_email($usuario['email'] ?? '');
                if ($usuarioEmail === '') {
                    continue;
                }
                $usuarioId = (string) ($usuario['id'] ?? '');
                $allowedId = (string) ($existingPostoUser['id'] ?? '');
                if ($usuarioEmail === $loginEmail && ($allowedId === '' || $usuarioId !== $allowedId)) {
                    http_response_code(409);
                    echo json_encode(['ok' => false, 'error' => 'email_in_use']);
                    exit;
                }
            }
        }

        $posto = [
            'id' => $postoId,
            'codigoMaquininha' => $codigoMaquininha,
            'codigoAcesso' => $codigoAcesso,
            'nome' => $nome,
        ];

        $cnpj = trim((string) ($incoming['cnpj'] ?? ''));
        if ($cnpj !== '') {
            $posto['cnpj'] = $cnpj;
        }
        $localizacao = trim((string) ($incoming['localizacao'] ?? ''));
        if ($localizacao !== '') {
            $posto['localizacao'] = $localizacao;
        }
        $lat = $incoming['lat'] ?? null;
        $lng = $incoming['lng'] ?? null;
        if (is_numeric($lat) && is_numeric($lng)) {
            $posto['lat'] = (float) $lat;
            $posto['lng'] = (float) $lng;
        }

        $currentState['postos'] = upsert_by_id($currentState['postos'], $posto);

        foreach ($currentState['empresas'] as $idx => $empresa) {
            if (!is_array($empresa)) {
                continue;
            }
            if (!isset($empresa['postosConvenio']) || !is_array($empresa['postosConvenio'])) {
                continue;
            }
            $allowed = normalize_string_list($empresa['postosConvenio']);
            if (!in_array($postoId, $allowed, true)) {
                $allowed[] = $postoId;
            }
            $empresa['postosConvenio'] = array_values($allowed);
            $currentState['empresas'][$idx] = $empresa;
        }

        if ($loginEmail !== '' && $loginSenha !== '') {
            $userId = trim((string) ($incoming['userId'] ?? ''));
            if ($userId === '' && is_array($existingPostoUser)) {
                $userId = (string) ($existingPostoUser['id'] ?? '');
            }
            if ($userId === '') {
                $userId = generate_entity_id('U');
            }
            $postoUser = [
                'id' => $userId,
                'nome' => $nome,
                'email' => $loginEmail,
                'senha' => $loginSenha,
                'role' => 'posto',
                'postoId' => $postoId,
            ];
            $currentState['usuarios'] = upsert_by_id($currentState['usuarios'], $postoUser);
        }

        try {
            replace_transacoes($pdo, $currentState['transacoes']);
        } catch (Throwable $e) {
            try {
                ensure_tables($pdo);
                replace_transacoes($pdo, $currentState['transacoes']);
            } catch (Throwable $e2) {
            }
        }

        $currentState = ensure_admin_user_state($currentState);
        $payload = json_encode($currentState, json_flags());
        if ($payload === false) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'db_encode_failed']);
            exit;
        }

        $stateSaved = true;
        $stmt = $pdo->prepare(
            'INSERT INTO app_state (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)'
        );
        try {
            $stmt->execute([$payload]);
        } catch (Throwable $e) {
            $stateSaved = false;
        }

        try {
            sync_empresa_registry_from_state($pdo, $currentState, false);
        } catch (Throwable $e) {
        }

        $currentState = apply_empresa_registry_to_state($currentState, load_empresa_registry($pdo));
        $currentState = apply_funcionario_registry_to_state($currentState, load_funcionario_registry($pdo));
        $currentState = ensure_admin_user_state($currentState);
        echo json_encode([
            'ok' => true,
            'data' => $currentState,
            'postoId' => $postoId,
            'warning' => $stateSaved ? '' : 'state_write_failed',
        ]);
        exit;
    }

    if ($action === 'update_funcionario_photo') {
        $funcionarioId = trim((string) ($incoming['funcionarioId'] ?? ''));
        $fotoData = (string) ($incoming['fotoData'] ?? '');
        if ($funcionarioId === '') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_funcionario_id']);
            exit;
        }
        if ($fotoData === '' || strlen($fotoData) > 700000 || !preg_match('/^data:image\//', $fotoData)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_foto']);
            exit;
        }

        $currentState = load_app_state($pdo) ?? [];
        if (!is_array($currentState)) {
            $currentState = [];
        }
        $currentState = apply_funcionario_registry_to_state($currentState, load_funcionario_registry($pdo));
        $currentState['funcionarios'] = normalize_list($currentState['funcionarios'] ?? []);
        $currentState['empresas'] = normalize_list($currentState['empresas'] ?? []);
        $currentState['postos'] = normalize_list($currentState['postos'] ?? []);
        $currentState['usuarios'] = normalize_list($currentState['usuarios'] ?? []);
        $currentState['colaboradoresAuth'] = normalize_list($currentState['colaboradoresAuth'] ?? []);
        $currentState['transacoes'] = normalize_list($currentState['transacoes'] ?? []);
        $currentState['logs'] = normalize_list($currentState['logs'] ?? []);

        $found = false;
        $funcionarioAtualizado = [];
        foreach ($currentState['funcionarios'] as $idx => $funcionario) {
            if (!is_array($funcionario) || (string) ($funcionario['id'] ?? '') !== $funcionarioId) {
                continue;
            }
            $funcionario['fotoData'] = $fotoData;
            $currentState['funcionarios'][$idx] = $funcionario;
            $funcionarioAtualizado = $funcionario;
            $found = true;
            break;
        }
        if (!$found) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'funcionario_not_found']);
            exit;
        }

        try {
            $cleanFuncionario = clean_funcionario_payload($funcionarioAtualizado);
            if (!$cleanFuncionario) {
                throw new RuntimeException('invalid_funcionario_payload');
            }
            upsert_funcionario_registry_entry($pdo, $cleanFuncionario);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'db_write_failed']);
            exit;
        }

        $currentState = ensure_admin_user_state($currentState);
        $payload = json_encode($currentState, json_flags());
        if ($payload === false) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'db_encode_failed']);
            exit;
        }

        $stateSaved = true;
        $stmt = $pdo->prepare(
            'INSERT INTO app_state (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)'
        );
        try {
            $stmt->execute([$payload]);
        } catch (Throwable $e) {
            $stateSaved = false;
        }

        $currentState = apply_empresa_registry_to_state($currentState, load_empresa_registry($pdo));
        $currentState = apply_funcionario_registry_to_state($currentState, load_funcionario_registry($pdo));
        $currentState = ensure_admin_user_state($currentState);
        echo json_encode([
            'ok' => true,
            'data' => $currentState,
            'warning' => $stateSaved ? '' : 'state_write_failed',
        ]);
        exit;
    }

    if ($action === 'delete_funcionario') {
        $funcionarioId = trim((string) ($incoming['funcionarioId'] ?? ''));
        if ($funcionarioId === '') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_funcionario_id']);
            exit;
        }

        $currentState = load_app_state($pdo) ?? [];
        if (!is_array($currentState)) {
            $currentState = [];
        }
        $currentState = apply_funcionario_registry_to_state($currentState, load_funcionario_registry($pdo));
        $result = delete_funcionario_state($currentState, $funcionarioId);
        if (!($result['deleted'] ?? false)) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'funcionario_not_found']);
            exit;
        }
        $updatedState = $result['state'];

        try {
            delete_funcionario_registry_by_id($pdo, $funcionarioId);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'db_write_failed']);
            exit;
        }

        try {
            replace_transacoes($pdo, normalize_list($updatedState['transacoes'] ?? []));
        } catch (Throwable $e) {
            try {
                ensure_tables($pdo);
                replace_transacoes($pdo, normalize_list($updatedState['transacoes'] ?? []));
            } catch (Throwable $e2) {
            }
        }

        $updatedState = ensure_admin_user_state($updatedState);
        $payload = json_encode($updatedState, json_flags());
        if ($payload === false) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'db_encode_failed']);
            exit;
        }
        $stmt = $pdo->prepare(
            'INSERT INTO app_state (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)'
        );
        try {
            $stmt->execute([$payload]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'db_write_failed']);
            exit;
        }

        $updatedState = apply_empresa_registry_to_state($updatedState, load_empresa_registry($pdo));
        $updatedState = apply_funcionario_registry_to_state($updatedState, load_funcionario_registry($pdo));
        $updatedState = ensure_admin_user_state($updatedState);
        echo json_encode(['ok' => true, 'data' => $updatedState]);
        exit;
    }

    if ($action === 'delete_empresa') {
        $empresaId = trim((string) ($incoming['empresaId'] ?? ''));
        if ($empresaId === '') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_empresa_id']);
            exit;
        }

        $currentState = load_app_state($pdo) ?? [];
        if (!is_array($currentState)) {
            $currentState = [];
        }
        $registryBefore = load_empresa_registry($pdo);
        $registryHadEmpresa = false;
        if ($registryBefore['ok'] ?? false) {
            foreach (normalize_list($registryBefore['empresas'] ?? []) as $empresaRow) {
                if ((string) ($empresaRow['id'] ?? '') === $empresaId) {
                    $registryHadEmpresa = true;
                    break;
                }
            }
        }

        $result = delete_empresa_state($currentState, $empresaId);
        $updatedState = $result['state'];
        $deleted = (bool) ($result['deleted'] ?? false) || $registryHadEmpresa;
        if (!$deleted) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'empresa_not_found']);
            exit;
        }

        try {
            delete_empresa_registry_by_id($pdo, $empresaId);
            delete_empresa_user_registry_by_empresa($pdo, $empresaId);
            delete_funcionario_credentials_by_empresa($pdo, $empresaId);
            delete_funcionario_registry_by_empresa($pdo, $empresaId);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'db_write_failed']);
            exit;
        }

        try {
            replace_transacoes($pdo, normalize_list($updatedState['transacoes'] ?? []));
        } catch (Throwable $e) {
            try {
                ensure_tables($pdo);
                replace_transacoes($pdo, normalize_list($updatedState['transacoes'] ?? []));
            } catch (Throwable $e2) {
                // nao interrompe exclusao principal do estado por falha de sync na tabela auxiliar
            }
        }

        $updatedState = ensure_admin_user_state($updatedState);
        $payload = json_encode($updatedState, json_flags());
        if ($payload === false) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'db_encode_failed']);
            exit;
        }
        $stmt = $pdo->prepare(
            'INSERT INTO app_state (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)'
        );
        try {
            $stmt->execute([$payload]);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => 'db_write_failed']);
            exit;
        }

        $updatedState = apply_empresa_registry_to_state($updatedState, load_empresa_registry($pdo));
        $updatedState = apply_funcionario_registry_to_state($updatedState, load_funcionario_registry($pdo));
        $updatedState = ensure_admin_user_state($updatedState);
        echo json_encode(['ok' => true, 'data' => $updatedState]);
        exit;
    }

    $incoming = array_merge($current, $incoming);

    $incoming['empresas'] = normalize_list($incoming['empresas'] ?? []);
    $incoming['postos'] = normalize_list($incoming['postos'] ?? []);
    $incoming['funcionarios'] = normalize_list($incoming['funcionarios'] ?? []);
    $incoming['usuarios'] = normalize_list($incoming['usuarios'] ?? []);
    $incoming['colaboradoresAuth'] = normalize_list($incoming['colaboradoresAuth'] ?? []);
    $incoming['transacoes'] = normalize_list($incoming['transacoes'] ?? []);
    $warnings = [];

    $currentFuncionarios = normalize_list($current['funcionarios'] ?? []);
    $incomingFuncionarios = $incoming['funcionarios'];
    // Snapshot generico sempre faz UPSERT por ID. Exclusao de funcionario so e
    // aceita pela acao delete_funcionario, evitando perda de cadastro por tela vazia/stale.
    if (count($currentFuncionarios) > count($incomingFuncionarios)) {
        $warnings[] = 'funcionarios_shrink_protected';
    }
    $incoming['funcionarios'] = merge_entities_by_id($currentFuncionarios, $incomingFuncionarios);

    $currentPostos = normalize_list($current['postos'] ?? []);
    $incomingPostos = $incoming['postos'];
    if (count($currentPostos) - count($incomingPostos) > 1) {
        $incoming['postos'] = merge_entities_by_id($currentPostos, $incomingPostos);
        $warnings[] = 'postos_shrink_protected';
    }

    $currentAuth = normalize_list($current['colaboradoresAuth'] ?? []);
    $incomingAuth = $incoming['colaboradoresAuth'];
    if (count($currentAuth) > count($incomingAuth)) {
        $warnings[] = 'auth_shrink_protected';
    }
    $incoming['colaboradoresAuth'] = merge_auth_entries($currentAuth, $incomingAuth);

    $currentUsuarios = normalize_list($current['usuarios'] ?? []);
    $incomingUsuarios = $incoming['usuarios'];
    $currentUsuariosFuncionario = array_values(array_filter(
        $currentUsuarios,
        static function (array $usuario): bool {
            return (string) ($usuario['role'] ?? '') === 'funcionario';
        }
    ));
    $incomingUsuariosFuncionario = array_values(array_filter(
        $incomingUsuarios,
        static function (array $usuario): bool {
            return (string) ($usuario['role'] ?? '') === 'funcionario';
        }
    ));
    $incomingUsuariosNaoFuncionario = array_values(array_filter(
        $incomingUsuarios,
        static function (array $usuario): bool {
            return (string) ($usuario['role'] ?? '') !== 'funcionario';
        }
    ));
    if (count($currentUsuariosFuncionario) > count($incomingUsuariosFuncionario)) {
        $warnings[] = 'usuarios_funcionario_shrink_protected';
    }
    $incoming['usuarios'] = array_values(array_merge(
        $incomingUsuariosNaoFuncionario,
        merge_entities_by_id($currentUsuariosFuncionario, $incomingUsuariosFuncionario)
    ));

    $incomingUsuarios = normalize_list($incoming['usuarios'] ?? []);
    $currentUsuariosPosto = array_values(array_filter(
        $currentUsuarios,
        static function (array $usuario): bool {
            return (string) ($usuario['role'] ?? '') === 'posto';
        }
    ));
    $incomingUsuariosPosto = array_values(array_filter(
        $incomingUsuarios,
        static function (array $usuario): bool {
            return (string) ($usuario['role'] ?? '') === 'posto';
        }
    ));
    if (count($currentUsuariosPosto) - count($incomingUsuariosPosto) > 1) {
        $incomingUsuariosNaoPosto = array_values(array_filter(
            $incomingUsuarios,
            static function (array $usuario): bool {
                return (string) ($usuario['role'] ?? '') !== 'posto';
            }
        ));
        $incoming['usuarios'] = array_values(array_merge(
            $incomingUsuariosNaoPosto,
            merge_entities_by_id($currentUsuariosPosto, $incomingUsuariosPosto)
        ));
        $warnings[] = 'usuarios_posto_shrink_protected';
    }

    $existingLogs = normalize_list($current['logs'] ?? []);
    $incomingLogs = normalize_list($incoming['logs'] ?? []);
    $incoming['logs'] = merge_by_id($existingLogs, $incomingLogs);

    $funcionarioCpfSet = [];
    $funcionarioIdSet = [];
    foreach ($incoming['funcionarios'] as $funcionario) {
        $id = (string) ($funcionario['id'] ?? '');
        if ($id !== '') {
            $funcionarioIdSet[$id] = true;
        }
        $cpf = preg_replace('/\D+/', '', (string) ($funcionario['cpf'] ?? ''));
        if ($cpf !== '') {
            $funcionarioCpfSet[$cpf] = true;
        }
    }

    if (isset($incoming['passwordResetTokens']) && is_array($incoming['passwordResetTokens'])) {
        $incoming['passwordResetTokens'] = array_values(array_filter(
            $incoming['passwordResetTokens'],
            static function ($entry) use ($funcionarioIdSet, $funcionarioCpfSet): bool {
                if (!is_array($entry)) {
                    return false;
                }
                $funcionarioId = (string) ($entry['funcionarioId'] ?? '');
                $cpf = preg_replace('/\D+/', '', (string) ($entry['cpf'] ?? ''));
                if ($funcionarioId !== '') {
                    return isset($funcionarioIdSet[$funcionarioId]);
                }
                if ($cpf !== '') {
                    return isset($funcionarioCpfSet[$cpf]);
                }
                return false;
            }
        ));
    }
    if (isset($incoming['passwordResetCodes']) && is_array($incoming['passwordResetCodes'])) {
        $incoming['passwordResetCodes'] = array_values(array_filter(
            $incoming['passwordResetCodes'],
            static function ($entry) use ($funcionarioIdSet, $funcionarioCpfSet): bool {
                if (!is_array($entry)) {
                    return false;
                }
                $funcionarioId = (string) ($entry['funcionarioId'] ?? '');
                $cpf = preg_replace('/\D+/', '', (string) ($entry['cpf'] ?? ''));
                if ($funcionarioId !== '') {
                    return isset($funcionarioIdSet[$funcionarioId]);
                }
                if ($cpf !== '') {
                    return isset($funcionarioCpfSet[$cpf]);
                }
                return false;
            }
        ));
    }

    try {
        replace_transacoes($pdo, $incoming['transacoes']);
    } catch (Throwable $e) {
        try {
            ensure_tables($pdo);
            replace_transacoes($pdo, $incoming['transacoes']);
        } catch (Throwable $e2) {
            // nao interrompe gravacao do app_state se tabela transacoes falhar
        }
    }

    try {
        sync_funcionario_registry_from_state($pdo, $incoming, false);
    } catch (Throwable $e) {
        // nao interrompe gravacao do app_state se tabela auxiliar falhar
    }

    $incoming = ensure_admin_user_state($incoming);
    $payload = json_encode($incoming, json_flags());
    if ($payload === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'db_encode_failed']);
        exit;
    }
    $stmt = $pdo->prepare(
        'INSERT INTO app_state (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)'
    );
    try {
        $stmt->execute([$payload]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'db_write_failed']);
        exit;
    }
    try {
        sync_empresa_registry_from_state($pdo, $incoming, false);
    } catch (Throwable $e) {
    }
    try {
        sync_credential_registry_from_state($pdo, $incoming);
    } catch (Throwable $e) {
        $warnings[] = 'usuarios_registry_sync_failed';
    }
    echo json_encode(['ok' => true, 'warnings' => $warnings]);
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
