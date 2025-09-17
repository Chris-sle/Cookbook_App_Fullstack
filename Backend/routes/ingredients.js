// routes/ingredients.js
const express = require('express')
const router = express.Router()
const pool = require('../db')

// GET /api/ingredients?q=tom&limit=10
// Returns array of { id, name }
router.get('/', async (req, res, next) => {
  const q = (req.query.q || '').trim()
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100)

  try {
    let result
    if (q) {
      // case-insensitive partial match
      result = await pool.query(
        'SELECT id, name FROM ingredients WHERE name ILIKE $1 ORDER BY name LIMIT $2',
        [`%${q}%`, limit]
      )
    } else {
      result = await pool.query(
        'SELECT id, name FROM ingredients ORDER BY name LIMIT $1',
        [limit]
      )
    }

    res.json(result.rows)
  } catch (err) {
    next(err)
  }
})

module.exports = router