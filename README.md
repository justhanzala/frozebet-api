# Frozebet Casino API Middleware

This project is a Node.js-based API middleware for casino game integration, acting as an intermediary between game providers and the casino's wallet system.

## Features

- Handles balance, bet, win, and refund actions
- Integrates with MySQL database for transaction storage
- Dynamic client configuration retrieval
- Request forwarding with authentication
- Error handling and logging

## Prerequisites

- Node.js (v14+)
- MySQL database
- npm

## Installation

1. Clone the repository
2. Run `npm install`
3. Set up `.env` file with database credentials and port
4. Set up MySQL database tables

## Usage

Start the server:

API will be available at `http://localhost:3000` (or specified port)

## API Endpoint

### POST /api/game-provider

Handles all game actions. Accepts parameters as query params, JSON body, or form-data.

Required fields:
- `action`: balance, bet, win, refund
- `player_id`: Player identifier
- Other fields as per action type

## Security

Uses HMAC-SHA256 for request signing when forwarding to client wallet system.

## Contributing

Contributions welcome. Please submit a Pull Request.

## License

[MIT](https://choosealicense.com/licenses/mit/)
