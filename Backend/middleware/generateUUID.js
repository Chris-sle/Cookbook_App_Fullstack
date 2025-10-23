const { uuid } = require('uuidv4');
const pool = require('../db'); // or correct relative path to your db module

function generateUniqueUUIDForTable(tableName) {
  return async (req, res, next) => {
    const client = await pool.connect();
    try {
      let exists = true;
      let newId;
      while (exists) {
        newId = uuid();
        const result = await client.query(`SELECT 1 FROM ${tableName} WHERE id = $1`, [newId]);
        exists = result.rows.length > 0;
      }
      req.generatedId = newId;
      next();
    } catch (err) {
      next(err);
    } finally {
      client.release();
    }
  };
}

module.exports = generateUniqueUUIDForTable;