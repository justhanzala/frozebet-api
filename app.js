require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const CLIENT_URL = "https://demo.frozebet.com/casino_wallet";
const AUTH_TOKEN =
  "9829c6293f9a737d0c9b7dec9ac5a67e1027ce9b46bb54c0e3efe8afd4e3c6b3668befad";

// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test database connection
pool
  .getConnection()
  .then((connection) => {
    console.log("Connected to MySQL database");
    connection.release();
  })
  .catch((err) => {
    console.error("Error connecting to MySQL database:", err);
    process.exit(1); // Exit the process if we can't connect to the database
  });

// Helper function to save transaction
async function saveTransaction(data) {
  const query = `
    INSERT INTO transactions 
    (action, player_id, amount, currency, game_uuid, transaction_id, session_id, type, freespin_id, quantity, round_id, finished) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    data.action,
    data.player_id,
    data.amount,
    data.currency,
    data.game_uuid,
    data.transaction_id,
    data.session_id,
    data.type,
    data.freespin_id,
    data.quantity,
    data.round_id,
    data.finished,
  ];

  try {
    const [result] = await pool.execute(query, values);
    return result.insertId;
  } catch (error) {
    console.error("Error saving transaction:", error);
    throw error;
  }
}

// Helper function to forward request to client
async function forwardToClient(data) {
  const body = new URLSearchParams(data).toString();
  const signature = crypto
    .createHmac("sha256", AUTH_TOKEN)
    .update(body)
    .digest("hex");

  try {
    const response = await axios.post(CLIENT_URL, body, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-REQUEST-SIGN": signature,
      },
      timeout: 10000, // 10 second timeout
    });

    if (!response.data) {
      throw new Error("Empty response from client");
    }
    return response.data;
  } catch (error) {
    console.error("Error forwarding request to client:", error);
    if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
      throw new Error("Client not responding");
    }
    throw new Error("Error communicating with client");
  }
}

// Main API endpoint
app.post("/api/game-provider", async (req, res) => {
  const { action } = req.body;

  try {
    // Save the incoming request to the database
    await saveTransaction(req.body);

    let clientResponse;
    switch (action) {
      case "balance":
        clientResponse = await handleBalance(req.body);
        break;
      case "bet":
        clientResponse = await handleBet(req.body);
        break;
      case "win":
        clientResponse = await handleWin(req.body);
        break;
      case "refund":
        clientResponse = await handleRefund(req.body);
        break;
      default:
        return res.status(400).json({ error: "Invalid action" });
    }

    res.json(clientResponse);
  } catch (error) {
    console.error("Error processing request:", error);
    if (error.message === "Client not responding") {
      res
        .status(504)
        .json({ error: "Client not responding, please try again later" });
    } else {
      res
        .status(500)
        .json({ error: "Internal server error, please try again later" });
    }
  }
});

async function handleBalance(data) {
  const clientResponse = await forwardToClient(data);
  return clientResponse;
}

async function handleBet(data) {
  const clientResponse = await forwardToClient(data);
  return clientResponse;
}

async function handleWin(data) {
  const clientResponse = await forwardToClient(data);
  return clientResponse;
}

async function handleRefund(data) {
  const clientResponse = await forwardToClient(data);
  return clientResponse;
}

// GET route for fetching all transactions
app.get("/transactions", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM transactions ORDER BY created_at DESC LIMIT 100"
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
