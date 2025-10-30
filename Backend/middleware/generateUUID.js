// middleware/generateUUID.js
const { uuid } = require('uuidv4');
const pool = require('../db');

async function generateUniqueUUIDForTable(tableName) {
  const client = await pool.connect();
  try {
    let exists = true;
    let newId;
    const MAX_ATTEMPTS = 5;
    let attempts = 0;
    while (exists) {
      if (++attempts > MAX_ATTEMPTS) {
        throw new Error('Failed to generate unique id after multiple attempts');
      }
      newId = uuid();
      const result = await client.query(`SELECT 1 FROM ${tableName} WHERE id = $1`, [newId]);
      exists = result.rows.length > 0;
    }
    return newId;
  } finally {
    client.release();
  }
}

module.exports = generateUniqueUUIDForTable;