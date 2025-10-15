const express = require('express');
const createError = require('http-errors');
const { body, param } = require('express-validator');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const validationHandler = require('../middleware/validationHandler');

/**
 * POST /recipes/:id/click
 * Optional auth: if authenticated, logs user_id in recipe_click_logs.
 * Returns { message, clicks }
 */
router.post(
  '/:id/click',
  [
    param('id').isInt().withMessage('id must be an integer'),
    validationHandler
  ],
  async (req, res, next) => {
    const recipeId = parseInt(req.params.id, 10);
    const userId = req.user ? req.user.user_id : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // ensure recipe exists
      const r = await client.query('SELECT id FROM recipes WHERE id = $1 LIMIT 1', [recipeId]);
      if (r.rows.length === 0) {
        await client.query('ROLLBACK');
        return next(createError(404, 'Recipe not found'));
      }

      // upsert counter
      const upsert = await client.query(
        `INSERT INTO recipe_clicks (recipe_id, clicks)
         VALUES ($1, 1)
         ON CONFLICT (recipe_id) DO UPDATE
         SET clicks = recipe_clicks.clicks + 1
         RETURNING clicks`,
        [recipeId]
      );
      const clicks = upsert.rows[0].clicks;

      // optional log
      if (userId) {
        await client.query(
          `INSERT INTO recipe_click_logs (recipe_id, user_id) VALUES ($1, $2)`,
          [recipeId, userId]
        );
      }

      await client.query('COMMIT');
      return res.json({ message: 'click recorded', clicks });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      next(err);
    } finally {
      client.release();
    }
  }
);

/**
 * Helper: fetch current aggregates and user's vote
 */
async function fetchVoteState(client, recipeId, userId = null) {
  // Check if recipes table has upvotes/downvotes/vote_score columns
  const recipeCols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='recipes' AND column_name IN ('upvotes','downvotes','vote_score')
  `);
  const hasCols = recipeCols.rows.length === 3;

  let upvotes = 0, downvotes = 0, score = 0;

  if (hasCols) {
    const r = await client.query('SELECT upvotes, downvotes, vote_score FROM recipes WHERE id = $1', [recipeId]);
    if (r.rows.length) {
      upvotes = parseInt(r.rows[0].upvotes, 10) || 0;
      downvotes = parseInt(r.rows[0].downvotes, 10) || 0;
      score = parseInt(r.rows[0].vote_score, 10) || 0;
    }
  } else {
    const agg = await client.query(
      `SELECT
         COALESCE(SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END),0) AS upvotes,
         COALESCE(SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END),0) AS downvotes,
         COALESCE(SUM(vote),0) AS score
       FROM recipe_votes
       WHERE recipe_id = $1`,
      [recipeId]
    );
    upvotes = parseInt(agg.rows[0].upvotes, 10);
    downvotes = parseInt(agg.rows[0].downvotes, 10);
    score = parseInt(agg.rows[0].score, 10);
  }

  let my_vote = 0;
  if (userId) {
    const mv = await client.query('SELECT vote FROM recipe_votes WHERE recipe_id = $1 AND user_id = $2', [recipeId, userId]);
    if (mv.rows.length) my_vote = parseInt(mv.rows[0].vote, 10);
  }

  return { upvotes, downvotes, score, my_vote };
}

/**
 * POST /recipes/:id/vote
 * Body: { vote: 1 | -1 | 0 }  (0 removes vote)
 * Requires auth
 */
router.post(
  '/:id/vote',
  authenticateToken,
  [
    param('id').isInt().withMessage('id must be an integer'),
    body('vote').isInt().custom(v => [1, -1, 0].includes(v)).withMessage('vote must be 1, -1 or 0'),
    validationHandler
  ],
  async (req, res, next) => {
    const recipeId = parseInt(req.params.id, 10);
    const userId = req.user.user_id;
    const vote = parseInt(req.body.vote, 10); // 1, -1, or 0

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // ensure recipe exists
      const r = await client.query('SELECT id FROM recipes WHERE id = $1 LIMIT 1', [recipeId]);
      if (r.rows.length === 0) {
        await client.query('ROLLBACK');
        return next(createError(404, 'Recipe not found'));
      }

      // get existing vote if any
      const existingRes = await client.query(
        'SELECT vote FROM recipe_votes WHERE recipe_id = $1 AND user_id = $2',
        [recipeId, userId]
      );
      const existing = existingRes.rows.length ? parseInt(existingRes.rows[0].vote, 10) : null;

      // If vote === 0 -> remove existing if present
      if (vote === 0) {
        if (existing !== null) {
          await client.query('DELETE FROM recipe_votes WHERE recipe_id = $1 AND user_id = $2', [recipeId, userId]);
          // adjust counters if present
          await client.query(
            `UPDATE recipes SET
               upvotes = GREATEST(upvotes - $1, 0),
               downvotes = GREATEST(downvotes - $2, 0),
               vote_score = vote_score - $3
             WHERE id = $4`,
            [existing === 1 ? 1 : 0, existing === -1 ? 1 : 0, existing, recipeId]
          );
        }
      } else {
        if (existing === null) {
          // insert
          await client.query('INSERT INTO recipe_votes (user_id, recipe_id, vote) VALUES ($1, $2, $3)', [userId, recipeId, vote]);
          await client.query(
            `UPDATE recipes SET
               upvotes = upvotes + $1,
               downvotes = downvotes + $2,
               vote_score = vote_score + $3
             WHERE id = $4`,
            [vote === 1 ? 1 : 0, vote === -1 ? 1 : 0, vote, recipeId]
          );
        } else if (existing === vote) {
          // no change
        } else {
          // flip vote
          await client.query('UPDATE recipe_votes SET vote = $1, updated_at = now() WHERE user_id = $2 AND recipe_id = $3', [vote, userId, recipeId]);
          const upDelta = (vote === 1 ? 1 : 0) - (existing === 1 ? 1 : 0);
          const downDelta = (vote === -1 ? 1 : 0) - (existing === -1 ? 1 : 0);
          const scoreDelta = vote - existing;
          await client.query(
            `UPDATE recipes SET
               upvotes = GREATEST(upvotes + $1, 0),
               downvotes = GREATEST(downvotes + $2, 0),
               vote_score = vote_score + $3
             WHERE id = $4`,
            [upDelta, downDelta, scoreDelta, recipeId]
          );
        }
      }

      // fetch updated aggregates and user's vote
      const state = await fetchVoteState(client, recipeId, userId);

      await client.query('COMMIT');
      return res.json({
        message: 'vote updated',
        recipe_id: recipeId,
        my_vote: state.my_vote,
        upvotes: state.upvotes,
        downvotes: state.downvotes,
        score: state.score
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      next(err);
    } finally {
      client.release();
    }
  }
);

/**
 * GET /recipes/:id/vote
 * Returns aggregates and (if authenticated) the current user's vote
 */
router.get(
  '/:id/vote',
  [
    param('id').isInt().withMessage('id must be an integer'),
    validationHandler
  ],
  async (req, res, next) => {
    const recipeId = parseInt(req.params.id, 10);
    const userId = req.user ? req.user.user_id : null;

    const client = await pool.connect();
    try {
      // ensure recipe exists
      const r = await client.query('SELECT id FROM recipes WHERE id = $1 LIMIT 1', [recipeId]);
      if (r.rows.length === 0) {
        return next(createError(404, 'Recipe not found'));
      }

      const state = await fetchVoteState(client, recipeId, userId);
      return res.json({
        recipe_id: recipeId,
        my_vote: state.my_vote,
        upvotes: state.upvotes,
        downvotes: state.downvotes,
        score: state.score
      });
    } catch (err) {
      next(err);
    } finally {
      client.release();
    }
  }
);

/**
 * DELETE /recipes/:id/vote
 * Alias for removing vote; requires auth
 */
router.delete(
  '/:id/vote',
  authenticateToken,
  [
    param('id').isInt().withMessage('id must be an integer'),
    validationHandler
  ],
  async (req, res, next) => {
    const recipeId = parseInt(req.params.id, 10);
    const userId = req.user.user_id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingRes = await client.query('SELECT vote FROM recipe_votes WHERE recipe_id = $1 AND user_id = $2', [recipeId, userId]);
      if (existingRes.rows.length === 0) {
        await client.query('COMMIT');
        return res.status(200).json({ message: 'no vote to remove' });
      }
      const existing = parseInt(existingRes.rows[0].vote, 10);

      await client.query('DELETE FROM recipe_votes WHERE recipe_id = $1 AND user_id = $2', [recipeId, userId]);

      await client.query(
        `UPDATE recipes SET
           upvotes = GREATEST(upvotes - $1, 0),
           downvotes = GREATEST(downvotes - $2, 0),
           vote_score = vote_score - $3
         WHERE id = $4`,
        [existing === 1 ? 1 : 0, existing === -1 ? 1 : 0, existing, recipeId]
      );

      const state = await fetchVoteState(client, recipeId, userId);

      await client.query('COMMIT');
      return res.json({
        message: 'vote removed',
        my_vote: state.my_vote,
        upvotes: state.upvotes,
        downvotes: state.downvotes,
        score: state.score
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      next(err);
    } finally {
      client.release();
    }
  }
);

module.exports = router;