const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { param, query } = require('express-validator');
const validationHandler = require('../middleware/validationHandler');

// Add a recipe to favorites
router.post(
  '/:recipeId',
  authenticateToken,
  [
    param('recipeId').isInt().withMessage('recipeId must be an integer'),
    validationHandler
  ],
  async (req, res, next) => {
    const recipeId = parseInt(req.params.recipeId, 10);
    const userId = req.user.user_id;

    try {
      // Ensure recipe exists
      const recipeRes = await pool.query('SELECT id FROM recipes WHERE id = $1', [recipeId]);
      if (recipeRes.rowCount === 0) {
        return res.status(404).json({ message: 'Recipe not found' });
      }

      // Prevent duplicate favorite
      const favRes = await pool.query(
        'SELECT 1 FROM favorites WHERE user_id = $1 AND recipe_id = $2',
        [userId, recipeId]
      );
      if (favRes.rowCount > 0) {
        return res.status(409).json({ message: 'Recipe already in favorites' });
      }

      await pool.query(
        'INSERT INTO favorites (user_id, recipe_id) VALUES ($1, $2)',
        [userId, recipeId]
      );

      res.status(201).json({ message: 'Recipe added to favorites' });
    } catch (err) {
      next(err);
    }
  }
);

// Remove a recipe from favorites
router.delete(
  '/:recipeId',
  authenticateToken,
  [
    param('recipeId').isInt().withMessage('recipeId must be an integer'),
    validationHandler
  ],
  async (req, res, next) => {
    const recipeId = parseInt(req.params.recipeId, 10);
    const userId = req.user.user_id;

    try {
      // Check if favorite exists
      const favRes = await pool.query(
        'SELECT 1 FROM favorites WHERE user_id = $1 AND recipe_id = $2',
        [userId, recipeId]
      );
      if (favRes.rowCount === 0) {
        return res.status(404).json({ message: 'Favorite not found' });
      }

      await pool.query('DELETE FROM favorites WHERE user_id = $1 AND recipe_id = $2', [userId, recipeId]);
      res.json({ message: 'Removed from favorites' });
    } catch (err) {
      next(err);
    }
  }
);

// List user's favorite recipes
router.get(
  '/',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be an integer >= 1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be an integer between 1 and 100'),
    validationHandler
  ],
  async (req, res, next) => {
    const userId = req.user.user_id;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const offset = (page - 1) * limit;

    const client = await pool.connect();
    try {
      const countRes = await client.query(
        'SELECT COUNT(*) AS total FROM favorites WHERE user_id = $1',
        [userId]
      );
      const total = parseInt(countRes.rows[0].total, 10);

      const results = await client.query(
        `SELECT r.*
         FROM recipes r
         JOIN favorites f ON r.id = f.recipe_id
         WHERE f.user_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      res.json({
        total,
        page,
        limit,
        data: results.rows
      });
    } catch (err) {
      next(err);
    } finally {
      client.release();
    }
  }
);

module.exports = router;