require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json());

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

// Helper function to get casino session data
async function getCasinoSession(userToSend) {
  const query = `
    SELECT auth_token, client_url, user_id
    FROM casino_sessions
    WHERE user_to_send = ?
  `;
  try {
    const [rows] = await pool.execute(query, [userToSend]);
    if (rows.length === 0) {
      throw new Error("Casino session not found");
    }
    return rows[0];
  } catch (error) {
    console.error("Error fetching casino session:", error);
    throw error;
  }
}

// Helper function to save transaction
async function saveTransaction(data) {
  const query = `
    INSERT INTO transactions 
    (action, player_id, amount, currency, game_uuid, transaction_id, session_id, type, freespin_id, quantity, round_id, finished) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    data.action || null,
    data.player_id || null,
    data.amount || null,
    data.currency || null,
    data.game_uuid || null,
    data.transaction_id || null,
    data.session_id || null,
    data.type || null,
    data.freespin_id || null,
    data.quantity || null,
    data.round_id || null,
    data.finished !== undefined ? data.finished : null,
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
  console.log("Incoming data:", data);
  
  const casinoSession = await getCasinoSession(data.player_id);
  
  // Here, we're not changing the player_id, as it's already the correct value
  const modifiedData = { ...data };
  
  console.log("Modified data to be sent to client:", modifiedData);

  const body = JSON.stringify(modifiedData);
  const signature = crypto
    .createHmac("sha256", casinoSession.auth_token)
    .update(body)
    .digest("hex");

  try {
    console.log(`Sending request to ${casinoSession.client_url}`);
    const response = await axios.post(casinoSession.client_url, body, {
      headers: {
        "Content-Type": "application/json",
        "X-REQUEST-SIGN": signature,
      },
      timeout: 10000, // 10 second timeout
    });

    if (!response.data) {
      throw new Error("Empty response from client");
    }
    console.log("Response from client:", response.data);
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
  console.log("Received request:", req.body);

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

    console.log("Client response:", clientResponse);
    res.json(clientResponse);
  } catch (error) {
    console.error("Error processing request:", error);
    if (error.message === "Client not responding") {
      res
        .status(504)
        .json({ error: "Client not responding, please try again later" });
    } else if (error.message === "Casino session not found") {
      res.status(404).json({ error: "Casino session not found" });
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
