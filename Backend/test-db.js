const pool = require('./db'); // Make sure your db.js exports the pool

(async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Database connection successful!');
    console.log('Current time from DB:', res.rows[0].now);
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
})();