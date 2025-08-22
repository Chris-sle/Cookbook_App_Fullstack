const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// POST /recipes (adding a new recipe)
router.post(
  '/', 
  authenticateToken, 
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('instructions').notEmpty().withMessage('Instructions are required'),
    body('ingredients').isArray({ min: 1 }).withMessage('Ingredients array required'),
    body('ingredients.*.ingredient_id').notEmpty().isInt().withMessage('Valid ingredient_id required'),
    body('ingredients.*.quantity').optional().isString()
  ],
  async (req, res) => {
    // Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, instructions, image_url, ingredients } = req.body;
    const author_id = req.user.user_id;

    try {
      // Insert into recipes
      const result = await pool.query(
        'INSERT INTO recipes (title, instructions, image_url, author_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [title, instructions, image_url, author_id]
      );

      const recipeId = result.rows[0].id;

      // Insert ingredients references
      for (const ing of ingredients) {
        await pool.query(
          'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity) VALUES ($1, $2, $3)',
          [recipeId, ing.ingredient_id, ing.quantity || null]
        );
      }

      res.json({ message: 'Recipe created', recipe_id: recipeId });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /recipes/search?ingredient=chicken&protein=chicken
router.get('/search', async (req, res) => {
  const { ingredient_id } = req.query;
  let query = `
    SELECT r.* FROM recipes r
    JOIN recipe_ingredients ri ON r.id = ri.recipe_id
  `;
  const params = [];

  if (ingredient_id) {
    params.push(ingredient_id);
    query += ` WHERE ri.ingredient_id = $${params.length}`;
  }

  try {
    const results = await pool.query(query, params.length ? params : undefined);
    res.json(results.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;