-- =========================================================
--  FireeeMart — Skema Database Inventori & Kas Toko Sembako
--  Kompatibel: MySQL 8+, MariaDB 10.4+ (XAMPP), TiDB Cloud
-- =========================================================

CREATE DATABASE IF NOT EXISTS fireeemart
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fireeemart;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS cash_transactions;
DROP TABLE IF EXISTS stock_opname_items;
DROP TABLE IF EXISTS stock_opnames;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- Pengguna aplikasi & perannya
--   owner  : akses penuh + kelola pengguna
--   kasir  : penjualan (stok keluar) & kas
--   gudang : barang masuk/keluar, produk, stock opname
CREATE TABLE users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  username      VARCHAR(50)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('owner','kasir','gudang') NOT NULL DEFAULT 'kasir',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB;

CREATE TABLE categories (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB;

-- Kolom `stock` HANYA diubah melalui stock_movements (masuk / keluar /
-- penyesuaian opname) agar setiap perubahan stok punya jejak audit.
CREATE TABLE products (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku         VARCHAR(50)  NOT NULL,
  name        VARCHAR(150) NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  unit        VARCHAR(30)  NOT NULL DEFAULT 'pcs',
  buy_price   DECIMAL(14,2) NOT NULL DEFAULT 0,
  sell_price  DECIMAL(14,2) NOT NULL DEFAULT 0,
  stock       DECIMAL(12,2) NOT NULL DEFAULT 0,
  min_stock   DECIMAL(12,2) NOT NULL DEFAULT 0,
  location    VARCHAR(100) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku),
  KEY idx_products_category (category_id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_products_stock CHECK (stock >= 0)
) ENGINE=InnoDB;

-- Kartu stok
CREATE TABLE stock_movements (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id   INT UNSIGNED NOT NULL,
  type         ENUM('IN','OUT','ADJUST') NOT NULL,
  quantity     DECIMAL(12,2) NOT NULL,           -- ADJUST bisa bernilai negatif
  stock_before DECIMAL(12,2) NOT NULL,
  stock_after  DECIMAL(12,2) NOT NULL,
  note         VARCHAR(255) NULL,
  reference    VARCHAR(100) NULL,                -- no. faktur / nota / kode opname
  created_by   INT UNSIGNED NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_movements_product_date (product_id, created_at),
  KEY idx_movements_date (created_at),
  CONSTRAINT fk_movements_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_movements_user FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE stock_opnames (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code          VARCHAR(30) NOT NULL,
  note          VARCHAR(255) NULL,
  total_items   INT UNSIGNED NOT NULL DEFAULT 0,
  matched_items INT UNSIGNED NOT NULL DEFAULT 0,
  created_by    INT UNSIGNED NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_opname_code (code),
  CONSTRAINT fk_opname_user FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE stock_opname_items (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  opname_id      INT UNSIGNED NOT NULL,
  product_id     INT UNSIGNED NOT NULL,
  system_stock   DECIMAL(12,2) NOT NULL,
  physical_stock DECIMAL(12,2) NOT NULL,
  difference     DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_opname_items_opname (opname_id),
  CONSTRAINT fk_opname_items_opname FOREIGN KEY (opname_id)
    REFERENCES stock_opnames (id) ON DELETE CASCADE,
  CONSTRAINT fk_opname_items_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Buku kas. Transaksi tidak bisa diedit/dihapus; koreksi dilakukan dengan
-- transaksi pembatalan (reversal_of) agar jejak audit tetap utuh.
CREATE TABLE cash_transactions (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type              ENUM('IN','OUT') NOT NULL,
  category          VARCHAR(50) NOT NULL,
  amount            DECIMAL(14,2) NOT NULL,
  description       VARCHAR(255) NULL,
  reference         VARCHAR(100) NULL,
  transaction_date  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  stock_movement_id BIGINT UNSIGNED NULL,      -- terisi jika berasal dari transaksi stok
  reversal_of       BIGINT UNSIGNED NULL,      -- terisi jika ini pembatalan transaksi lain
  created_by        INT UNSIGNED NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cash_movement (stock_movement_id),
  UNIQUE KEY uq_cash_reversal (reversal_of),
  KEY idx_cash_date (transaction_date),
  CONSTRAINT fk_cash_movement FOREIGN KEY (stock_movement_id)
    REFERENCES stock_movements (id) ON DELETE SET NULL,
  CONSTRAINT fk_cash_reversal FOREIGN KEY (reversal_of)
    REFERENCES cash_transactions (id) ON DELETE RESTRICT,
  CONSTRAINT fk_cash_user FOREIGN KEY (created_by)
    REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT chk_cash_amount CHECK (amount > 0)
) ENGINE=InnoDB;
