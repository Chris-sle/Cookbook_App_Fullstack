const express = require('express');
const createError = require('http-errors');
const { body, param, query } = require('express-validator');
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

// GET /api/recipes/search?ingredient_id=1,2&category_id=3&q=soup&page=1&limit=20
router.get(
  '/search',
  [
    // simple validator for integer params; we also validate/parse in code for arrays
    query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
    validationHandler
  ],
  async (req, res, next) => {
    try {
      // Parse and normalize incoming query params
      const rawIngredient = req.query.ingredient_id;
      const rawCategory = req.query.category_id;
      const q = req.query.q ? String(req.query.q).trim() : null;

      // Pagination
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const offset = (page - 1) * limit;

      // Helper: parse id lists from comma-separated string, array, or single value.
      const parseIdList = (raw) => {
        if (raw == null) return null;
        // If array (repeated query param), flatten into string
        const str = Array.isArray(raw) ? raw.join(',') : String(raw);
        const parts = str.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length === 0) return null;
        const nums = parts.map(p => {
          const n = Number(p);
          if (!Number.isInteger(n)) throw new Error(`Invalid id value: ${p}`);
          return n;
        });
        // remove duplicates
        return Array.from(new Set(nums));
      };

      let ingredientIds = null;
      let categoryIds = null;
      try {
        ingredientIds = parseIdList(rawIngredient);
        categoryIds = parseIdList(rawCategory);
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }

      // Build dynamic WHERE conditions and params array
      const conditions = [];
      const params = [];

      if (ingredientIds && ingredientIds.length > 0) {
        // pass PostgreSQL integer array as a single parameter
        params.push(ingredientIds);
        conditions.push(`EXISTS (
          SELECT 1 FROM recipe_ingredients ri2
          WHERE ri2.recipe_id = r.id AND ri2.ingredient_id = ANY($${params.length}::int[])
        )`);
      }

      if (categoryIds && categoryIds.length > 0) {
        params.push(categoryIds);
        conditions.push(`EXISTS (
          SELECT 1 FROM recipe_categories rc2
          WHERE rc2.recipe_id = r.id AND rc2.category_id = ANY($${params.length}::int[])
        )`);
      }

      if (q) {
        // Use ILIKE for simple case-insensitive substring match
        params.push(`%${q}%`);
        conditions.push(`(r.title ILIKE $${params.length} OR r.instructions ILIKE $${params.length})`);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count query to get total distinct recipes matching filters
      const countQuery = `
        SELECT COUNT(DISTINCT r.id) AS total
        FROM recipes r
        ${whereClause}
      `;

      const countResult = await pool.query(countQuery, params.length ? params : undefined);
      const total = parseInt(countResult.rows[0].total, 10) || 0;

      // Data query with aggregations and pagination
      // Note: LIMIT and OFFSET are passed as parameters appended to the params array
      params.push(limit);
      params.push(offset);
      const dataQuery = `
        SELECT
          r.*,
          u.username AS author_username,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', i.id,
              'name', i.name,
              'quantity', ri.quantity
            )) FROM recipe_ingredients ri
              JOIN ingredients i ON ri.ingredient_id = i.id
            WHERE ri.recipe_id = r.id
          ), '[]'::json) AS ingredients,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', c.id,
              'name', c.name
            )) FROM recipe_categories rc
              JOIN categories c ON rc.category_id = c.id
            WHERE rc.recipe_id = r.id
          ), '[]'::json) AS categories
        FROM recipes r
        LEFT JOIN users u ON r.author_id = u.id
        ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `;

      const dataResult = await pool.query(dataQuery, params);
      const recipes = dataResult.rows;

      // Return paginated response with meta
      return res.json({
        data: recipes,
        meta: {
          total,
          page,
          limit
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
