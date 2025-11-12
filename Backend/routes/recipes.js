const express = require('express');
const createError = require('http-errors');
const { body, param, query } = require('express-validator');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const validationHandler = require('../middleware/validationHandler');
const generateUniqueUUIDForTable = require('../middleware/generateUUID');
const validateUUIDFormat = require('../middleware/validateUUID');

const {
  insertRecipe,
  validateProvidedIds,
  ensureNames,
  fetchIdsByNames,
  findSimilarEntityId,
  bulkInsertAssociations
} = require('../lib/entityHelpers');

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

      // --------- Ingredients Processing ---------
      const ingredientIdsToValidate = [];
      const ingredientNamesSet = new Set();

      for (const ing of ingredients) {
        if (!ing) continue;

        if (ing.ingredient_id != null && ing.ingredient_id !== '') {
          // Validate UUID format
          await validateUUIDFormat(ing.ingredient_id);
          ingredientIdsToValidate.push(ing.ingredient_id);
        } else {
          const rawName = String(ing.name || '').trim();
          if (!rawName) throw createError(400, 'Ingredient name cannot be empty');
          ingredientNamesSet.add(rawName.toLowerCase());
        }
      }

      // Validate existing ingredient IDs
      if (ingredientIdsToValidate.length) {
        await validateProvidedIds(client, 'ingredients', ingredientIdsToValidate);
      }

      // Ensure all ingredient names are in the DB
      const ingredientNamesArray = Array.from(ingredientNamesSet);
      if (ingredientNamesArray.length) {
        await ensureNames(client, 'ingredients', ingredientNamesArray);
      }

      // Fetch IDs for all ingredients (existing + new ones will be inserted first if needed)
      const ingredientNameIdMap = await fetchIdsByNames(client, 'ingredients', ingredientNamesArray);

      // --- Insert new ingredients for names that don't exist yet ---
      const newIngredientNames = ingredientNamesArray.filter(
        name => !ingredientNameIdMap[name]
      );

      // Generate UUIDs and insert new ingredients
      const newIngredientIdMap = {}; // name -> id
      for (const name of newIngredientNames) {
        const newId = await generateUniqueUUIDForTable('ingredients');
        await client.query(
          `INSERT INTO ingredients (id, name) VALUES ($1, $2)`,
          [newId, name]
        );
        newIngredientIdMap[name] = newId;
      }

      // Combine existing and newly created ingredient IDs
      const finalIngredientIdMap = { ...ingredientNameIdMap, ...newIngredientIdMap };

      // Prepare association rows
      const recipeIngredientRows = [];
      for (const ing of ingredients) {
        if (!ing) continue;
        let ingredientId;
        if (ing.ingredient_id != null && ing.ingredient_id !== '') {
          // UUID validated earlier
          ingredientId = ing.ingredient_id;
        } else {
          const normalized = String(ing.name || '').trim().toLowerCase();
          ingredientId = finalIngredientIdMap[normalized];
        }
        if (!ingredientId) throw createError(400, `Cannot resolve ingredient for ${ing.name || ing.ingredient_id}`);
        recipeIngredientRows.push([recipeId, ingredientId, ing.quantity || null]);
      }

      // --- Categories Processing (similar approach) ---

      const categoryIdsToValidate = [];
      const categoryNamesSet = new Set();

      for (const c of categories) {
        if (!c) continue;

        if (c.category_id != null && c.category_id !== '') {
          // validate UUID
          await validateUUIDFormat(c.category_id);
          categoryIdsToValidate.push(c.category_id);
        } else {
          const rawName = String(c.name || '').trim();
          if (!rawName) throw createError(400, 'Category name cannot be empty');
          categoryNamesSet.add(rawName.toLowerCase());
        }
      }

      // Validate existing category IDs
      if (categoryIdsToValidate.length) {
        await validateProvidedIds(client, 'categories', categoryIdsToValidate);
      }

      // Ensure category names exist
      const categoryNamesArray = Array.from(categoryNamesSet);
      if (categoryNamesArray.length) {
        await ensureNames(client, 'categories', categoryNamesArray);
      }

      // Fetch IDs for categories
      const categoryNameIdMap = await fetchIdsByNames(client, 'categories', categoryNamesArray);

      // Insert new categories for names that don't exist
      const newCategoryNames = categoryNamesArray.filter(name => !categoryNameIdMap[name]);
      const newCategoryIdMap = {};
      for (const name of newCategoryNames) {
        const newId = await generateUniqueUUIDForTable('categories');
        await client.query(
          `INSERT INTO categories (id, name) VALUES ($1, $2)`,
          [newId, name]
        );
        newCategoryIdMap[name] = newId;
      }

      // Combine all category IDs
      const finalCategoryIdMap = { ...categoryNameIdMap, ...newCategoryIdMap };

      // Prepare category association rows
      const recipeCategoryRows = [];
      for (const c of categories) {
        if (!c) continue;
        let categoryId;
        if (c.category_id != null && c.category_id !== '') {
          // UUID validated earlier
          categoryId = c.category_id;
        } else {
          const normalized = String(c.name || '').trim().toLowerCase();
          categoryId = finalCategoryIdMap[normalized];
        }
        if (!categoryId) throw createError(400, `Cannot resolve category for ${c.name || c.category_id}`);
        recipeCategoryRows.push([recipeId, categoryId]);
      }

      // ----------------------------------------------
      // Insert associations
      await bulkInsertAssociations(
        client,
        'recipe_ingredients',
        ['recipe_id', 'ingredient_id', 'quantity'],
        recipeIngredientRows
      );

      await bulkInsertAssociations(
        client,
        'recipe_categories',
        ['recipe_id', 'category_id'],
        recipeCategoryRows
      );

      await client.query('COMMIT');
      return res.status(201).json({ message: 'Recipe created', recipe_id: recipeId });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => { });
      next(err);
    } finally {
      client.release();
    }
  }
);

// PUT /api/recipes/:id
router.put(
  '/:id',
  authenticateToken,
  [
    param('id').isUUID().withMessage('id must be a UUID'),
    body('title').optional().isString(),
    body('instructions').optional().isString(),
    body('image_url').optional().isURL(),
    body('ingredients').optional().isArray(),
    body('ingredients.*').custom((val) => {
      if (!val) return true;
      if ((!val.name || !String(val.name).trim()) && !val.ingredient_id) {
        throw new Error('Each ingredient must include a name or ingredient_id');
      }
      return true;
    }),
    body('categories').optional().isArray(),
    body('categories.*').custom((val) => {
      if (!val) return true;
      if ((!val.name || !String(val.name).trim()) && !val.category_id) {
        throw new Error('Each category must include a name or category_id');
      }
      return true;
    }),
    validationHandler
  ],
  async (req, res, next) => {
    const recipeId = req.params.id;
    const { title, instructions, image_url, ingredients = null, categories = null } = req.body;
    const userId = req.user && req.user.user_id;
    const isAdmin = req.user && req.user.is_admin;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // ensure recipe exists and permission
      const r = await client.query('SELECT author_id FROM recipes WHERE id = $1', [recipeId]);
      if (r.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Recipe not found' });
      }
      const authorId = r.rows[0].author_id;
      if (!isAdmin && authorId !== userId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Forbidden' });
      }

      // Update recipe fields if provided
      const updateFields = [];
      const updateParams = [];
      let idx = 1;
      if (title !== undefined) { updateFields.push(`title = $${idx++}`); updateParams.push(title); }
      if (instructions !== undefined) { updateFields.push(`instructions = $${idx++}`); updateParams.push(instructions); }
      if (image_url !== undefined) { updateFields.push(`image_url = $${idx++}`); updateParams.push(image_url); }

      if (updateFields.length) {
        updateParams.push(recipeId);
        await client.query(
          `UPDATE recipes SET ${updateFields.join(', ')} WHERE id = $${updateParams.length}`,
          updateParams
        );
      }

      // ------ Ingredients handling ------
      if (ingredients) {
        // gather provided ids and names
        const providedIngredientIds = [];
        const ingredientNamesSet = new Set();
        for (const ing of ingredients) {
          if (!ing) continue;
          if (ing.ingredient_id != null && String(ing.ingredient_id).trim() !== '') {
            providedIngredientIds.push(String(ing.ingredient_id).trim());
          } else {
            const raw = String(ing.name || '').trim();
            if (!raw) throw createError(400, 'Ingredient name cannot be empty');
            ingredientNamesSet.add(raw.toLowerCase());
          }
        }

        // validate provided ids exist
        if (providedIngredientIds.length) {
          await validateProvidedIds(client, 'ingredients', providedIngredientIds);
        }

        // ensure names exist and fetch ids
        const ingredientNamesToEnsure = Array.from(ingredientNamesSet);
        if (ingredientNamesToEnsure.length) await ensureNames(client, 'ingredients', ingredientNamesToEnsure);
        const ingredientNameIdMap = await fetchIdsByNames(client, 'ingredients', ingredientNamesToEnsure);

        // try fuzzy match for unresolved names
        for (const name of ingredientNamesToEnsure) {
          if (!ingredientNameIdMap[name]) {
            const simId = await findSimilarEntityId(client, 'ingredients', name);
            if (simId) ingredientNameIdMap[name] = simId;
          }
        }

        // build associations [recipe_id, ingredient_id, quantity]
        const recipeIngredientRows = [];
        for (const ing of ingredients) {
          if (!ing) continue;
          let ingredientId;
          if (ing.ingredient_id != null && String(ing.ingredient_id).trim() !== '') {
            ingredientId = String(ing.ingredient_id).trim();
          } else {
            const normalized = String(ing.name || '').trim().toLowerCase();
            ingredientId = ingredientNameIdMap[normalized];
          }
          if (!ingredientId) throw createError(400, `Could not resolve ingredient id for "${ing.name || ing.ingredient_id}"`);
          recipeIngredientRows.push([recipeId, ingredientId, ing.quantity || null]);
        }

        // replace associations
        await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [recipeId]);
        if (recipeIngredientRows.length) {
          await bulkInsertAssociations(client, 'recipe_ingredients', ['recipe_id', 'ingredient_id', 'quantity'], recipeIngredientRows);
        }
      }

      // ------ Categories handling ------
      if (categories) {
        const providedCategoryIds = [];
        const categoryNamesSet = new Set();
        for (const c of categories) {
          if (!c) continue;
          if (c.category_id != null && String(c.category_id).trim() !== '') {
            providedCategoryIds.push(String(c.category_id).trim());
          } else {
            const raw = String(c.name || '').trim();
            if (!raw) throw createError(400, 'Category name cannot be empty');
            categoryNamesSet.add(raw.toLowerCase());
          }
        }

        if (providedCategoryIds.length) await validateProvidedIds(client, 'categories', providedCategoryIds);

        const categoryNamesToEnsure = Array.from(categoryNamesSet);
        if (categoryNamesToEnsure.length) await ensureNames(client, 'categories', categoryNamesToEnsure);
        let categoryNameIdMap = await fetchIdsByNames(client, 'categories', categoryNamesToEnsure);

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
          if (c.category_id != null && String(c.category_id).trim() !== '') {
            categoryId = String(c.category_id).trim();
          } else {
            const normalized = String(c.name || '').trim().toLowerCase();
            categoryId = categoryNameIdMap[normalized];
          }
          if (!categoryId) throw createError(400, `Could not resolve category id for "${c.name || c.category_id}"`);
          recipeCategoryRows.push([recipeId, categoryId]);
        }

        await client.query('DELETE FROM recipe_categories WHERE recipe_id = $1', [recipeId]);
        if (recipeCategoryRows.length) {
          await bulkInsertAssociations(client, 'recipe_categories', ['recipe_id', 'category_id'], recipeCategoryRows);
        }
      }

      await client.query('COMMIT');
      return res.json({ message: 'Recipe updated', recipe_id: recipeId });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => { });
      next(err);
    } finally {
      client.release();
    }
  }
);

// DELETE /api/recipes/:id
router.delete(
  '/:id',
  authenticateToken,
  [
    param('id').isUUID().withMessage('Recipe ID must be a UUID'),
    validationHandler
  ],
  async (req, res, next) => {
    const { id } = req.params;
    const requesterId = req.user && req.user.user_id;
    const isAdmin = req.user && req.user.is_admin;

    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Check if recipe exists and permission
        const r = await client.query('SELECT author_id FROM recipes WHERE id = $1', [id]);
        if (r.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ message: 'Recipe not found' });
        }

        const authorId = r.rows[0].author_id;
        if (!isAdmin && authorId !== requesterId) {
          await client.query('ROLLBACK');
          return res.status(403).json({ message: 'Forbidden' });
        }

        // Delete the recipe (assuming foreign keys with ON DELETE CASCADE)
        await client.query('DELETE FROM recipes WHERE id = $1', [id]);

        await client.query('COMMIT');
        res.json({ message: 'Recipe deleted', recipe_id: id });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        next(err);
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Delete recipe error:', err);
      res.status(500).json({ message: 'Server error' });
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