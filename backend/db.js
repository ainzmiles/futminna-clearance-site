// This file manages the connection pool to the PostgreSQL database.
// It uses the DATABASE_URL environment variable provided by Render for the connection string.
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Heroku/Render require SSL connections, but they don't provide the certs.
  // This configuration is necessary for the connection to succeed on these platforms.
  ssl: {
    rejectUnauthorized: false,
  },
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};
