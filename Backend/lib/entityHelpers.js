const createError = require('http-errors');
const generateUniqueUUIDForTable = require('../middleware/generateUUID');


/**
 * Generic DB helpers for name/id entities (ingredients, categories).
 * All functions expect an active client (from pool.connect()) so they can be
 * used inside a transaction.
 *
 * Note: `table` values are inserted directly into query text (trusted internal code).
 * Do not pass user-provided table names.
 */

/**
 * Insert recipe and return its id.
 */
async function insertRecipe(client, { title, instructions, image_url, author_id }) {
  const recipeId = await generateUniqueUUIDForTable('recipes');
  const res = await client.query(
    `INSERT INTO recipes (id, title, instructions, image_url, author_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [recipeId, title, instructions, image_url || null, author_id]
  );
  return recipeId;
}

/**
 * Validate provided IDs exist in given table (e.g. 'ingredients' or 'categories').
 * Throws 400 if any are missing.
 */
async function validateProvidedIds(client, table, providedIds) {
  if (!providedIds || providedIds.length === 0) return;
  const res = await client.query(
    `SELECT id FROM ${table} WHERE id = ANY($1)`,
    [providedIds]
  );
  const found = new Set(res.rows.map(r => r.id));
  const missing = providedIds.filter(id => !found.has(id));
  if (missing.length > 0) {
    throw createError(400, `Provided ${table.slice(0, -1)}_id(s) not found: ${missing.join(', ')}`);
  }
}

/**
 * Batch-insert normalized lower-case names into `table`.
 * namesNormalized: array of distinct lower-cased names.
 *
 * Uses CTE + NOT EXISTS; must be used along with a UNIQUE index on LOWER(name)
 * to be concurrency-safe.
 */
async function ensureNames(client, table, namesNormalized) {
  if (!namesNormalized || namesNormalized.length === 0) return;
  await client.query(
    `
    WITH new_names(name) AS (
      SELECT UNNEST($1::text[])
    )
    INSERT INTO ${table} (name)
    SELECT name FROM new_names
    WHERE NOT EXISTS (
      SELECT 1 FROM ${table} t WHERE LOWER(t.name) = new_names.name
    )
    `,
    [namesNormalized]
  );
}

/**
 * Fetch mapping normalizedLowerName -> id for rows in `table`.
 * Returns object { normalizedName: id, ... }.
 */
async function fetchIdsByNames(client, table, namesNormalized) {
  if (!namesNormalized || namesNormalized.length === 0) return {};
  const res = await client.query(
    `SELECT id, name FROM ${table} WHERE LOWER(name) = ANY($1)`,
    [namesNormalized]
  );
  const map = {};
  for (const r of res.rows) {
    map[r.name.trim().toLowerCase()] = r.id;
  }
  return map;
}

/**
 * Optional fuzzy match by similarity (pg_trgm). Returns id or null.
 * Will silently skip fuzzy attempt if pg_trgm functions not available.
 */
async function findSimilarEntityId(client, table, normalizedName) {
  // exact match first
  const exact = await client.query(`SELECT id FROM ${table} WHERE LOWER(name) = $1 LIMIT 1`, [normalizedName]);
  if (exact.rows.length) return exact.rows[0].id;

  // try fuzzy similarity (requires pg_trgm)
  try {
    const threshold = 0.4; // tune threshold if needed
    const fuzzyRes = await client.query(
      `
      SELECT id, similarity(name, $1) AS sim
      FROM ${table}
      WHERE similarity(name, $1) > $2
      ORDER BY sim DESC
      LIMIT 1
      `,
      [normalizedName, threshold]
    );
    if (fuzzyRes.rows.length) return fuzzyRes.rows[0].id;
  } catch (err) {
    // pg_trgm likely not installed — just ignore and return null
  }

  return null;
}

/**
 * Bulk insert associations (join table).
 * - table: join table name (e.g. recipe_ingredients, recipe_categories)
 * - columns: array of column names to insert, e.g. ['recipe_id','ingredient_id','quantity']
 * - associations: array of arrays of values matching columns order
 *
 * Adds ON CONFLICT DO NOTHING so duplicates won't crash.
 */
async function bulkInsertAssociations(client, table, columns, associations) {
  if (!associations || associations.length === 0) return;
  const valuesSql = [];
  const params = [];
  let idx = 1;
  for (const row of associations) {
    const placeholders = row.map(() => `$${idx++}`);
    valuesSql.push(`(${placeholders.join(', ')})`);
    params.push(...row);
  }
  const cols = columns.join(', ');
  const sql = `INSERT INTO ${table} (${cols}) VALUES ${valuesSql.join(', ')} ON CONFLICT DO NOTHING`;
  await client.query(sql, params);
}

module.exports = {
  insertRecipe,
  validateProvidedIds,
  ensureNames,
  fetchIdsByNames,
  findSimilarEntityId,
  bulkInsertAssociations
};