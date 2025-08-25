const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { body, query } = require('express-validator');
const validationHandler = require('../middleware/validationHandler');

// POST /api/recipes - create recipe (requires auth)
router.post(
  '/',
  authenticateToken,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('instructions').notEmpty().withMessage('Instructions are required'),
    body('image_url').optional().isURL().withMessage('image_url must be a valid URL'),
    body('ingredients').isArray({ min: 1 }).withMessage('Ingredients array required'),
    body('ingredients.*.ingredient_id').notEmpty().isInt().withMessage('Valid ingredient_id required'),
    body('ingredients.*.quantity').optional().isString(),
    validationHandler
  ],
  async (req, res, next) => {
    const { title, instructions, image_url, ingredients } = req.body;
    const author_id = req.user.user_id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertRecipe = await client.query(
        'INSERT INTO recipes (title, instructions, image_url, author_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [title, instructions, image_url || null, author_id]
      );
      const recipeId = insertRecipe.rows[0].id;

      const insertIngredientText = 'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity) VALUES ($1, $2, $3)';

      for (const ing of ingredients) {
        await client.query(insertIngredientText, [recipeId, parseInt(ing.ingredient_id, 10), ing.quantity || null]);
      }

      await client.query('COMMIT');
      res.status(201).json({ message: 'Recipe created', recipe_id: recipeId });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      next(err); // let global error handler respond
    } finally {
      client.release();
    }
  }
);

// GET /api/recipes/search?ingredient_id=1
router.get(
  '/search',
  [
    query('ingredient_id').optional().isInt().withMessage('ingredient_id must be an integer'),
    validationHandler
  ],
  async (req, res, next) => {
    const { ingredient_id } = req.query;
    let queryText = `
      SELECT DISTINCT r.* FROM recipes r
      JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    `;
    const params = [];

    if (ingredient_id) {
      params.push(parseInt(ingredient_id, 10));
      queryText += ` WHERE ri.ingredient_id = $1`;
    }

    try {
      const results = await pool.query(queryText, params.length ? params : undefined);
      res.json(results.rows);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;