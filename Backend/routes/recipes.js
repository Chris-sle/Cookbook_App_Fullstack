const express = require('express');
const createError = require('http-errors');
const { body, query } = require('express-validator');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const validationHandler = require('../middleware/validationHandler');

const {
  insertRecipe,
  validateProvidedIds,
  ensureNames,
  fetchIdsByNames,
  findSimilarEntityId,
  bulkInsertAssociations
} = require('../lib/entityHelpers'); // adjust path if you put lib elsewhere

// POST /api/recipes
router.post(
  '/',
  authenticateToken,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('instructions').notEmpty().withMessage('Instructions are required'),
    body('image_url').optional().isURL().withMessage('image_url must be a valid URL'),
    body('ingredients').isArray({ min: 1 }).withMessage('Ingredients array required'),
    body('ingredients.*').custom((val) => {
      if (!val) throw new Error('Invalid ingredient item');
      if ((!val.name || !String(val.name).trim()) && !val.ingredient_id) {
        throw new Error('Each ingredient must include a name or ingredient_id');
      }
      return true;
    }),
    body('ingredients.*.quantity').optional().isString(),
    body('categories').optional().isArray(),
    body('categories.*').optional().custom((val) => {
      if (!val) return true;
      if ((!val.name || !String(val.name).trim()) && !val.category_id) {
        throw new Error('Each category must include a name or category_id');
      }
      return true;
    }),
    validationHandler
  ],
  async (req, res, next) => {
    const { title, instructions, image_url, ingredients = [], categories = [] } = req.body;
    const author_id = req.user && req.user.user_id;
    if (!author_id) return next(createError(401, 'Missing authenticated user'));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // create recipe
      const recipeId = await insertRecipe(client, { title, instructions, image_url, author_id });

      // ---- Ingredients ----
      const ingredientProvidedIds = [];
      const ingredientNamesSet = new Set();
      for (const ing of ingredients) {
        if (!ing) continue;
        if (ing.ingredient_id != null && ing.ingredient_id !== '') {
          const idNum = parseInt(ing.ingredient_id, 10);
          if (Number.isNaN(idNum)) throw createError(400, `Invalid ingredient_id: ${ing.ingredient_id}`);
          ingredientProvidedIds.push(idNum);
        } else {
          const raw = String(ing.name || '').trim();
          if (!raw) throw createError(400, 'Ingredient name cannot be empty');
          ingredientNamesSet.add(raw.toLowerCase());
        }
      }

      if (ingredientProvidedIds.length) await validateProvidedIds(client, 'ingredients', ingredientProvidedIds);

      const ingredientNamesToEnsure = Array.from(ingredientNamesSet);
      if (ingredientNamesToEnsure.length) await ensureNames(client, 'ingredients', ingredientNamesToEnsure);

      const ingredientNameIdMap = await fetchIdsByNames(client, 'ingredients', ingredientNamesToEnsure);

      const recipeIngredientRows = [];
      for (const ing of ingredients) {
        if (!ing) continue;
        let ingredientId;
        if (ing.ingredient_id != null && ing.ingredient_id !== '') {
          ingredientId = parseInt(ing.ingredient_id, 10);
        } else {
          const normalized = String(ing.name || '').trim().toLowerCase();
          ingredientId = ingredientNameIdMap[normalized];
        }
        if (!ingredientId) throw createError(400, `Could not resolve ingredient id for "${ing.name || ing.ingredient_id}"`);
        recipeIngredientRows.push([recipeId, ingredientId, ing.quantity || null]);
      }

      await bulkInsertAssociations(client, 'recipe_ingredients', ['recipe_id', 'ingredient_id', 'quantity'], recipeIngredientRows);

      // ---- Categories ----
      const categoryProvidedIds = [];
      const categoryNamesSet = new Set();
      for (const c of categories) {
        if (!c) continue;
        if (c.category_id != null && c.category_id !== '') {
          const idNum = parseInt(c.category_id, 10);
          if (Number.isNaN(idNum)) throw createError(400, `Invalid category_id: ${c.category_id}`);
          categoryProvidedIds.push(idNum);
        } else {
          const raw = String(c.name || '').trim();
          if (!raw) throw createError(400, 'Category name cannot be empty');
          categoryNamesSet.add(raw.toLowerCase());
        }
      }

      if (categoryProvidedIds.length) await validateProvidedIds(client, 'categories', categoryProvidedIds);

      const categoryNamesToEnsure = Array.from(categoryNamesSet);
      if (categoryNamesToEnsure.length) await ensureNames(client, 'categories', categoryNamesToEnsure);

      let categoryNameIdMap = await fetchIdsByNames(client, 'categories', categoryNamesToEnsure);

      // try fuzzy for unresolved
      for (const name of categoryNamesToEnsure) {
        if (!categoryNameIdMap[name]) {
          const simId = await findSimilarEntityId(client, 'categories', name);
          if (simId) categoryNameIdMap[name] = simId;
        }
      }

      const recipeCategoryRows = [];
      for (const c of categories) {
        if (!c) continue;
        let categoryId;
        if (c.category_id != null && c.category_id !== '') {
          categoryId = parseInt(c.category_id, 10);
        } else {
          const normalized = String(c.name || '').trim().toLowerCase();
          categoryId = categoryNameIdMap[normalized];
        }
        if (!categoryId) throw createError(400, `Could not resolve category id for "${c.name || c.category_id}"`);
        recipeCategoryRows.push([recipeId, categoryId]);
      }

      await bulkInsertAssociations(client, 'recipe_categories', ['recipe_id', 'category_id'], recipeCategoryRows);

      await client.query('COMMIT');
      return res.status(201).json({ message: 'Recipe created', recipe_id: recipeId });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      next(err);
    } finally {
      client.release();
    }
  }
);

// keep your recipe search GET handler below (unchanged)
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
