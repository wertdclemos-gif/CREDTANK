-- Rewards module schema migration
CREATE TABLE IF NOT EXISTS rewards_users (
  id VARCHAR(64) PRIMARY KEY,
  tier VARCHAR(16) NOT NULL DEFAULT 'bronze',
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reward_accounts (
  user_id VARCHAR(64) PRIMARY KEY,
  points_available BIGINT NOT NULL DEFAULT 0,
  points_pending BIGINT NOT NULL DEFAULT 0,
  cashback_available DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  cashback_pending DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_reward_accounts_user FOREIGN KEY (user_id) REFERENCES rewards_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reward_ledgers (
  id CHAR(36) PRIMARY KEY,
  event_key VARCHAR(191) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  external_transaction_id VARCHAR(128) NOT NULL,
  type VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL,
  amount_points BIGINT NOT NULL DEFAULT 0,
  amount_cashback DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  base_amount DECIMAL(14,2) NULL,
  eligible_amount DECIMAL(14,2) NULL,
  campaign_id VARCHAR(64) NULL,
  available_at DATETIME NULL,
  expires_at DATETIME NULL,
  related_ledger_id CHAR(36) NULL,
  metadata LONGTEXT NULL,
  created_by VARCHAR(64) NULL,
  source VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_reward_ledgers_event_key UNIQUE KEY (event_key),
  KEY idx_reward_ledgers_user_created (user_id, created_at),
  KEY idx_reward_ledgers_user_status (user_id, status),
  KEY idx_reward_ledgers_external (external_transaction_id),
  KEY idx_reward_ledgers_related (related_ledger_id),
  CONSTRAINT fk_reward_ledgers_user FOREIGN KEY (user_id) REFERENCES rewards_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reward_campaigns (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  points_multiplier DECIMAL(8,4) NOT NULL DEFAULT 1.0000,
  cashback_bonus_pp DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
  caps_json LONGTEXT NULL,
  eligibility_rules_json LONGTEXT NULL,
  stackable TINYINT(1) NOT NULL DEFAULT 1,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reward_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reward_user_flags (
  user_id VARCHAR(64) PRIMARY KEY,
  rewards_enabled TINYINT(1) NOT NULL DEFAULT 1,
  reason VARCHAR(255) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reward_merchant_flags (
  merchant_id VARCHAR(64) PRIMARY KEY,
  rewards_enabled TINYINT(1) NOT NULL DEFAULT 1,
  reason VARCHAR(255) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reward_metrics_daily (
  metric_date DATE NOT NULL,
  metric_key VARCHAR(64) NOT NULL,
  metric_value DECIMAL(20,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (metric_date, metric_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP VIEW IF EXISTS reward_points_expiring_soon;
CREATE VIEW reward_points_expiring_soon AS
SELECT rl.user_id,
       SUM(CASE WHEN rl.type = 'EARN_POINTS' AND rl.status = 'AVAILABLE' THEN rl.amount_points ELSE 0 END) AS points_expiring_soon
FROM reward_ledgers rl
WHERE rl.expires_at IS NOT NULL
  AND rl.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)
GROUP BY rl.user_id;
