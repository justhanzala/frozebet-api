const express = require('express');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
pool.getConnection()
  .then(connection => {
    console.log('Connected to MySQL database');
    connection.release();
  })
  .catch(err => {
    console.error('Error connecting to MySQL database:', err);
    process.exit(1); // Exit the process if we can't connect to the database
  });

// Input validation middleware
const validateInput = (req, res, next) => {
  const { action, player_id, currency, session_id } = req.body;
  if (!action || !player_id || !currency || !session_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!["balance", "bet", "win", "refund"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }
  if (action !== "balance") {
    const { amount, game_uuid, transaction_id, type } = req.body;
    if (!amount || !game_uuid || !transaction_id || !type) {
      return res
        .status(400)
        .json({ error: "Missing required fields for non-balance action" });
    }
    if (typeof amount !== "number" || amount < 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
  }
  next();
};

// POST route for all actions
app.post("/bet", validateInput, async (req, res) => {
  const {
    action,
    player_id,
    currency,
    session_id,
    amount,
    game_uuid,
    transaction_id,
    type,
    freespin_id,
    quantity,
    round_id,
    finished,
    bet_transaction_id,
  } = req.body;

  try {
    let result;
    let balance;

    switch (action) {
      case "balance":
        [result] = await pool.execute(
          "SELECT balance FROM bets WHERE player_id = ? ORDER BY created_at DESC LIMIT 1",
          [player_id]
        );
        balance = result[0] ? result[0].balance : 0;
        return res.json({ balance });

      case "bet":
      case "win":
      case "refund":
        // Check if transaction already exists
        [result] = await pool.execute(
          "SELECT * FROM bets WHERE transaction_id = ? AND action = ?",
          [transaction_id, action]
        );
        if (result.length > 0) {
          return res.json({
            balance: result[0].balance,
            transaction_id: result[0].transaction_id,
          });
        }

        // Get current balance
        [result] = await pool.execute(
          "SELECT balance FROM bets WHERE player_id = ? ORDER BY created_at DESC LIMIT 1",
          [player_id]
        );
        balance = result[0] ? result[0].balance : 0;

        // Update balance based on action
        if (action === "bet") balance -= amount;
        if (action === "win" || action === "refund") balance += amount;

        // Insert new transaction
        [result] = await pool.execute(
          "INSERT INTO bets (action, amount, currency, game_uuid, player_id, transaction_id, session_id, type, freespin_id, quantity, round_id, finished, bet_transaction_id, balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            action,
            amount,
            currency,
            game_uuid,
            player_id,
            transaction_id,
            session_id,
            type,
            freespin_id,
            quantity,
            round_id,
            finished,
            bet_transaction_id,
            balance,
          ]
        );

        return res.json({ balance, transaction_id });

      default:
        return res.status(400).json({ error: "Invalid action" });
    }
  } catch (error) {
    console.error("Error processing bet:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET route for fetching all bets
app.get("/bets", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM bets ORDER BY created_at DESC LIMIT 100");
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching bets:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
