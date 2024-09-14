CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action ENUM('balance', 'bet', 'win', 'refund') NOT NULL,
  player_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2),
  currency VARCHAR(3),
  game_uuid VARCHAR(255),
  transaction_id VARCHAR(255) UNIQUE,
  session_id VARCHAR(255),
  type VARCHAR(50),
  freespin_id VARCHAR(255),
  quantity INT,
  round_id VARCHAR(255),
  finished BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
