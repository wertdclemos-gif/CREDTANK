<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function ensure_tables(PDO $pdo): void
{
    $sql = <<<SQL
CREATE TABLE IF NOT EXISTS app_state (
  id TINYINT UNSIGNED PRIMARY KEY,
  data LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
SQL;
    $pdo->exec($sql);

    $sql = <<<SQL
CREATE TABLE IF NOT EXISTS transacoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transacao_id VARCHAR(40) NOT NULL UNIQUE,
  funcionario_id VARCHAR(40) NOT NULL,
  empresa_id VARCHAR(40) NOT NULL,
  posto_id VARCHAR(40) NOT NULL,
  valor DECIMAL(12, 2) NOT NULL,
  data_hora DATETIME NOT NULL,
  payload LONGTEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_transacoes_funcionario (funcionario_id),
  KEY idx_transacoes_empresa (empresa_id),
  KEY idx_transacoes_posto (posto_id),
  KEY idx_transacoes_data (data_hora)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
SQL;
    $pdo->exec($sql);

    $sql = <<<SQL
CREATE TABLE IF NOT EXISTS app_empresas (
  empresa_id VARCHAR(40) NOT NULL PRIMARY KEY,
  nome VARCHAR(190) NOT NULL,
  cnpj VARCHAR(30) DEFAULT NULL,
  fechamento VARCHAR(40) DEFAULT NULL,
  limite_mensal DECIMAL(12, 2) NOT NULL DEFAULT 500.00,
  postos_convenio LONGTEXT NOT NULL,
  payload LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
SQL;
    $pdo->exec($sql);

    $sql = <<<SQL
CREATE TABLE IF NOT EXISTS app_funcionarios (
  funcionario_id VARCHAR(40) NOT NULL PRIMARY KEY,
  empresa_id VARCHAR(40) NOT NULL,
  nome VARCHAR(190) NOT NULL,
  cpf VARCHAR(30) DEFAULT NULL,
  matricula VARCHAR(60) DEFAULT NULL,
  localidade VARCHAR(190) DEFAULT NULL,
  foto_data MEDIUMTEXT NULL,
  payload LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_app_funcionarios_empresa (empresa_id),
  KEY idx_app_funcionarios_cpf (cpf),
  KEY idx_app_funcionarios_matricula (matricula),
  KEY idx_app_funcionarios_localidade (localidade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
SQL;
    $pdo->exec($sql);

    $sql = <<<SQL
CREATE TABLE IF NOT EXISTS app_usuarios (
  user_id VARCHAR(40) NOT NULL PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  cpf VARCHAR(20) DEFAULT NULL,
  role VARCHAR(30) NOT NULL,
  nome VARCHAR(190) NOT NULL,
  senha VARCHAR(190) NOT NULL,
  empresa_id VARCHAR(40) DEFAULT NULL,
  posto_id VARCHAR(40) DEFAULT NULL,
  funcionario_id VARCHAR(40) DEFAULT NULL,
  payload LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_app_usuarios_email_role (email, role),
  KEY idx_app_usuarios_empresa (empresa_id),
  KEY idx_app_usuarios_cpf (cpf),
  KEY idx_app_usuarios_funcionario (funcionario_id),
  KEY idx_app_usuarios_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
SQL;
    $pdo->exec($sql);

    // Migra instalacoes anteriores sem apagar usuarios ja cadastrados.
    $columns = $pdo->query('SHOW COLUMNS FROM app_usuarios')->fetchAll(PDO::FETCH_COLUMN) ?: [];
    if (!in_array('cpf', $columns, true)) {
        $pdo->exec('ALTER TABLE app_usuarios ADD COLUMN cpf VARCHAR(20) DEFAULT NULL AFTER email');
    }
    if (!in_array('funcionario_id', $columns, true)) {
        $pdo->exec('ALTER TABLE app_usuarios ADD COLUMN funcionario_id VARCHAR(40) DEFAULT NULL AFTER posto_id');
    }
    $indexes = $pdo->query('SHOW INDEX FROM app_usuarios')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $indexNames = array_values(array_unique(array_map(static fn(array $row): string => (string) ($row['Key_name'] ?? ''), $indexes)));
    if (!in_array('idx_app_usuarios_cpf', $indexNames, true)) {
        $pdo->exec('ALTER TABLE app_usuarios ADD KEY idx_app_usuarios_cpf (cpf)');
    }
    if (!in_array('idx_app_usuarios_funcionario', $indexNames, true)) {
        $pdo->exec('ALTER TABLE app_usuarios ADD KEY idx_app_usuarios_funcionario (funcionario_id)');
    }
}
