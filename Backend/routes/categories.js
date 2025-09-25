const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/suggest', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, name FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
