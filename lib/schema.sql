-- WalimApp AI — MariaDB schema (Task 01).
-- Mirrors the JSON file mode in data/ (users.json, sessions.json, inquiries.json).
-- Timestamps are ISO-8601 strings (VARCHAR) so both modes share one shape.

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(80) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'customer',
  status VARCHAR(16) NOT NULL DEFAULT 'approved',
  phone VARCHAR(32) NULL,
  business_name VARCHAR(120) NULL,
  wilaya VARCHAR(8) NULL,
  commune VARCHAR(60) NULL,
  business_description TEXT NULL,
  created_at VARCHAR(32) NOT NULL,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'customer',
  created_at VARCHAR(32) NOT NULL,
  expires_at VARCHAR(32) NOT NULL,
  KEY idx_sessions_user_id (user_id),
  KEY idx_sessions_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inquiries (
  reference VARCHAR(32) PRIMARY KEY,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  hall_id VARCHAR(64) NOT NULL,
  hall_name TEXT NOT NULL,
  wilaya VARCHAR(8) NOT NULL,
  name VARCHAR(80) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  `date` VARCHAR(16) NOT NULL,
  guests INT NOT NULL,
  message TEXT NOT NULL,
  consent TINYINT(1) NOT NULL DEFAULT 1,
  consent_at VARCHAR(32) NULL,
  lang VARCHAR(8) NOT NULL DEFAULT 'fr',
  created_at VARCHAR(32) NOT NULL,
  owner_note TEXT NULL,
  decided_at VARCHAR(32) NULL,
  customer_id VARCHAR(64) NULL,
  KEY idx_inquiries_status (status),
  KEY idx_inquiries_customer_id (customer_id),
  KEY idx_inquiries_hall_date (hall_id, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS halls (
  id VARCHAR(64) PRIMARY KEY,
  owner_id VARCHAR(64) NULL,
  payload MEDIUMTEXT NOT NULL,
  KEY idx_halls_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
