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
const validateBetInput = (req, res, next) => {
  const { action, amount, currency, game_uuid, player_id, transaction_id, session_id, type } = req.body;
  if (!action || !amount || !currency || !game_uuid || !player_id || !transaction_id || !session_id || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!['bet', 'tip', 'freespin'].includes(action) || !['bet', 'tip', 'freespin'].includes(type)) {
    return res.status(400).json({ error: 'Invalid action or type' });
  }
  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  next();
};

// POST route for adding a bet
app.post("/bet", validateBetInput, async (req, res) => {
  try {
    const [result] = await pool.execute(
      "INSERT INTO bets (action, amount, currency, game_uuid, player_id, transaction_id, session_id, type, freespin_id, quantity, round_id, finished) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        req.body.action,
        req.body.amount,
        req.body.currency,
        req.body.game_uuid,
        req.body.player_id,
        req.body.transaction_id,
        req.body.session_id,
        req.body.type,
        req.body.freespin_id || null,
        req.body.quantity || null,
        req.body.round_id || null,
        req.body.finished || false,
      ]
    );
    res.json({ success: true, insertId: result.insertId });
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
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});