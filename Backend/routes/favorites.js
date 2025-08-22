const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');

// Add a recipe to favorites
router.post('/:recipeId', authenticateToken, async (req, res) => {
  try {
    const { recipeId } = req.params;
    const userId = req.user.user_id;
    await pool.query(
      'INSERT INTO favorites (user_id, recipe_id) VALUES ($1, $2)',
      [userId, recipeId]
    );
    res.json({ message: 'Recipe added to favorites' });
  } catch (err) {
    res.status(500).json({ message: 'Server error or already favorited' });
  }
});

// Remove a recipe from favorites
router.delete('/:recipeId', authenticateToken, async (req, res) => {
  try {
    const { recipeId } = req.params;
    const userId = req.user.user_id;
    await pool.query(
      'DELETE FROM favorites WHERE user_id=$1 AND recipe_id=$2',
      [userId, recipeId]
    );
    res.json({ message: 'Removed from favorites' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// List user's favorite recipes
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const results = await pool.query(
      'SELECT * FROM recipes WHERE id IN (SELECT recipe_id FROM favorites WHERE user_id = $1)',
      [userId]
    );
    res.json(results.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;