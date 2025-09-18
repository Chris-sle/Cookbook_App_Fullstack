const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { body, query } = require('express-validator');
const validationHandler = require('../middleware/validationHandler');

/**
 * Helper: Insert recipe and return its id.
 */
async function insertRecipe(client, { title, instructions, image_url, author_id }) {
  const res = await client.query(
    `INSERT INTO recipes (title, instructions, image_url, author_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [title, instructions, image_url || null, author_id]
  )
  return res.rows[0].id
}

/**
 * Helper: Validate that provided ingredient IDs exist.
 * Throws an error if any provided id does not exist.
 */
async function validateProvidedIds(client, providedIds) {
  if (!providedIds || providedIds.length === 0) return

  const res = await client.query(
    'SELECT id FROM ingredients WHERE id = ANY($1)',
    [providedIds]
  )
  const found = new Set(res.rows.map(r => r.id))
  const missing = providedIds.filter(id => !found.has(id))
  if (missing.length > 0) {
    throw new Error(`Provided ingredient_id(s) not found: ${missing.join(', ')}`)
  }
}

/**
 * Helper: Batch insert missing normalized names.
 * namesNormalized: array of distinct lower-cased names.
 *
 * insert only names that do not already exist.
 */
async function ensureIngredientNames(client, namesNormalized) {
  if (!namesNormalized || namesNormalized.length === 0) return

  // Use CTE + UNNEST; insert only names not already existing.
  // This inserts new rows (with lower-case names) in one statement.
  await client.query(
    `
    WITH new_names(name) AS (
      SELECT UNNEST($1::text[])
    )
    INSERT INTO ingredients (name)
    SELECT name FROM new_names
    WHERE NOT EXISTS (
      SELECT 1 FROM ingredients i WHERE i.name = new_names.name
    )
    `,
    [namesNormalized]
  )
}

/**
 * Helper: Get id -> name map for a list of normalized names.
 * Returns object: { normalizedName: id, ... }
 */
async function fetchIngredientIdsByNames(client, namesNormalized) {
  if (!namesNormalized || namesNormalized.length === 0) return {}

  const res = await client.query(
    'SELECT id, name FROM ingredients WHERE name = ANY($1)',
    [namesNormalized]
  )
  const map = {}
  for (const r of res.rows) {
    // r.name is stored normalized (lower-case)
    map[r.name] = r.id
  }
  return map
}

/**
 * Helper: Bulk insert recipe_ingredients with one query
 * associations: array of { recipe_id, ingredient_id, quantity }
 */
async function insertRecipeIngredientsBulk(client, associations) {
  if (!associations || associations.length === 0) return

  const valuesSql = []
  const params = []
  let idx = 1
  for (const a of associations) {
    valuesSql.push(`($${idx++}, $${idx++}, $${idx++})`)
    params.push(a.recipe_id, a.ingredient_id, a.quantity)
  }
  const sql = `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity) VALUES ${valuesSql.join(', ')}`
  await client.query(sql, params)
}

/**
 * POST /api/recipes
 * Accepts ingredients as array of { name?: string, ingredient_id?: int, quantity?: string }
 */
router.post(
  '/',
  authenticateToken,
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('instructions').notEmpty().withMessage('Instructions are required'),
    body('image_url').optional().isURL().withMessage('image_url must be a valid URL'),
    body('ingredients').isArray({ min: 1 }).withMessage('Ingredients array required'),
    body('ingredients.*').custom((val) => {
      if (!val) throw new Error('Invalid ingredient item')
      // require either a non-empty name or an ingredient_id
      if ((!val.name || !String(val.name).trim()) && !val.ingredient_id) {
        throw new Error('Each ingredient must include a name or ingredient_id')
      }
      return true
    }),
    body('ingredients.*.quantity').optional().isString(),
    validationHandler
  ],
  async (req, res, next) => {
    const { title, instructions, image_url, ingredients } = req.body
    const author_id = req.user.user_id

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1) Insert recipe and get id
      const recipeId = await insertRecipe(client, { title, instructions, image_url, author_id })

      // 2) Separate provided IDs and names to ensure
      const providedIds = []
      const namesToEnsureSet = new Set() // normalized names (lower-case)
      // We'll also keep the original mapping between normalized name and original (if needed)
      for (const ing of ingredients) {
        if (ing.ingredient_id) {
          // allow numeric strings too
          providedIds.push(parseInt(ing.ingredient_id, 10))
        } else {
          const raw = String(ing.name || '').trim()
          if (!raw) {
            throw new Error('Ingredient name cannot be empty')
          }
          const normalized = raw.toLowerCase()
          namesToEnsureSet.add(normalized)
        }
      }

      // 3) Validate provided IDs exist
      if (providedIds.length > 0) {
        await validateProvidedIds(client, providedIds)
      }

      // 4) Batch insert missing names
      const namesToEnsure = Array.from(namesToEnsureSet)
      if (namesToEnsure.length > 0) {
        await ensureIngredientNames(client, namesToEnsure)
      }

      // 5) Fetch ids for names (name -> id map)
      const nameIdMap = await fetchIngredientIdsByNames(client, namesToEnsure)

      // 6) Build associations array for bulk insert
      const associations = []
      for (const ing of ingredients) {
        let ingredientId = null
        if (ing.ingredient_id) {
          ingredientId = parseInt(ing.ingredient_id, 10)
        } else {
          const normalized = String(ing.name || '').trim().toLowerCase()
          ingredientId = nameIdMap[normalized]
        }

        if (!ingredientId) {
          throw new Error(`Could not resolve ingredient id for "${ing.name || ing.ingredient_id}"`)
        }

        associations.push({
          recipe_id: recipeId,
          ingredient_id: ingredientId,
          quantity: ing.quantity || null
        })
      }

      // 7) Bulk insert recipe_ingredients
      await insertRecipeIngredientsBulk(client, associations)

      // 8) Commit and respond
      await client.query('COMMIT')
      return res.status(201).json({ message: 'Recipe created', recipe_id: recipeId })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      next(err)
    } finally {
      client.release()
    }
  }
)

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