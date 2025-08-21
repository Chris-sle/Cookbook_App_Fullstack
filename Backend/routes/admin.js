const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');

// route: DELETE /recipes/:id
router.delete('/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM recipes WHERE id=$1', [id]);
    res.json({ message: 'Recipe deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;