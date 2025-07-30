CREATE DATABASE if not exists portfolio_db;
use portfolio_db;

CREATE TABLE `holdings` (
  `id` integer AUTO_INCREMENT PRIMARY KEY,
  `ticker` VARCHAR(255) NOT NULL,
  `quantity` DECIMAL(18, 8) NOT NULL CHECK(quantity>0),
  `cost_basis` DECIMAL(10,4) NOT NULL,
  `portfolio_id` INTEGER NOT NULL
);

CREATE TABLE `portfolios` (
  `id` INTEGER PRIMARY KEY,
  `name` VARCHAR(255),
  `cash_balance` DECIMAL(10,4)
);

CREATE TABLE `transactions` (
  `id` INTEGER PRIMARY KEY,
  `transaction_type` VARCHAR(255),
  `price` DECIMAL(10,4),
  `quantity` INTEGER,
  `transaction_date` TIMESTAMP(3),
  `portfolio_id` INTEGER NOT NULL
);

ALTER TABLE `holdings` ADD CONSTRAINT `portfolio_holdings` FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios` (`id`);

ALTER TABLE `transactions` ADD CONSTRAINT `cash_transactions` FOREIGN KEY (`portfolio_id`) REFERENCES `portfolios` (`id`);
