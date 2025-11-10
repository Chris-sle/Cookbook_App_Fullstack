const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeAdmin = require('../middleware/admin');
const { param, body, query } = require('express-validator');
const validationHandler = require('../middleware/validationHandler');
const emailHelpers = require('../lib/emailHelpers');

/** LIST USERS with pagination */
router.get(
  '/users',
  authenticateToken,
  authorizeAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit must be between 1 and 200'),
    validationHandler
  ],
  async (req, res, next) => {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const offset = (page - 1) * limit;
    try {
      const client = await pool.connect();
      try {
        const totalRes = await client.query('SELECT COUNT(*) AS total FROM users');
        const total = parseInt(totalRes.rows[0].total, 10);
        const usersRes = await client.query(
          `SELECT id, username, email, is_admin, status, suspended_until, created_at
           FROM users
           ORDER BY created_at DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        );
        res.json({ total, page, limit, data: usersRes.rows });
      } finally {
        client.release();
      }
    } catch (err) {
      next(err);
    }
  }
);

/** Delete a user (can't delete yourself) */
router.delete(
  '/users/:id',
  authenticateToken,
  authorizeAdmin,
  [
    param('id').isUUID().withMessage('id must be a UUID'),
    validationHandler
  ],
  async (req, res, next) => {
    const targetId = parseInt(req.params.id, 10);
    const requesterId = req.user.user_id;
    if (targetId === requesterId) {
      return res.status(403).json({ message: "You can't delete your own account" });
    }
    try {
      await pool.query('DELETE FROM users WHERE id=$1', [targetId]);
      res.json({ message: 'User deleted' });
    } catch (err) {
      next(err);
    }
  }
);

/** Ban a user (set status = 'banned') */
router.post(
  '/users/:id/ban',
  authenticateToken,
  authorizeAdmin,
  [
    param('id').isUUID().withMessage('id must be a UUID'),
    validationHandler
  ],
  async (req, res, next) => {
    const targetId = req.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // update status
      await client.query('UPDATE users SET status = $1 WHERE id = $2', ['banned', targetId]);

      // fetch email & username to notify
      const u = await client.query('SELECT username, email FROM users WHERE id = $1', [targetId]);
      if (u.rows.length) {
        const { username, email } = u.rows[0];
        // send ban email (do not block response if mail fails; log error)
        try {
          const { sendBanEmail } = require('../lib/emailHelpers');
          await sendBanEmail(email, username);
        } catch (mailErr) {
          console.error('Failed to send ban email:', mailErr);
        }
      }

      await client.query('COMMIT');
      res.json({ message: 'User banned' });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      next(err);
    } finally {
      client.release();
    }
  }
);

/** Suspend a user for given days (optional: suspend_until timestamp) */
router.post(
  '/users/:id/suspend',
  authenticateToken,
  authorizeAdmin,
  [
    param('id').isUUID().withMessage('id must be a UUID'),
    body('duration').optional().isInt({ min: 1 }),
    validationHandler
  ],
  async (req, res, next) => {
    const targetId = req.params.id;
    const { duration } = req.body;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const suspendUntil = new Date();
      suspendUntil.setDate(suspendUntil.getDate() + (duration ? Number(duration) : 1));

      await client.query('UPDATE users SET suspended_until = $1 WHERE id = $2', [suspendUntil, targetId]);

      // fetch email & username to notify
      const u = await client.query('SELECT username, email FROM users WHERE id = $1', [targetId]);
      if (u.rows.length) {
        const { username, email } = u.rows[0];
        try {
          const { sendSuspensionEmail } = require('../lib/emailHelpers');
          await sendSuspensionEmail(email, username, `${Math.ceil((suspendUntil - new Date())/(24*3600*1000))} days`);
        } catch (mailErr) {
          console.error('Failed to send suspension email:', mailErr);
        }
      }

      await client.query('COMMIT');
      res.json({ message: `User suspended until ${suspendUntil.toISOString()}` });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      next(err);
    } finally {
      client.release();
    }
  }
);

// GET /logistics
router.get('/logistics', 
  authenticateToken, 
  authorizeAdmin, 
  async (req, res, next) => {
    try {
      const [totalUsersRes, totalRecipesRes] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM users'),
        pool.query('SELECT COUNT(*) FROM recipes')
      ]);
      res.json({
        totalUsers: totalUsersRes.rows[0].count,
        totalRecipes: totalRecipesRes.rows[0].count,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /promote/:id
router.post('/promote/:id', 
  authenticateToken, 
  authorizeAdmin,
  [
    param('id').isUUID().withMessage('id must be a UUID'),
    validationHandler
  ],
  async (req, res, next) => {
    const userId = parseInt(req.params.id, 10);
    try {
      const userRes = await pool.query('SELECT id FROM users WHERE id=$1', [userId]);
      if (userRes.rowCount === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      await pool.query('UPDATE users SET is_admin=TRUE WHERE id=$1', [userId]);
      res.json({ message: 'User promoted to admin' });
    } catch (err) {
      next(err);
    }
  }
);

// 4) Admin: list recipes with no author (orphaned recipes)
router.get('/admin/orphaned-recipes', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const results = await pool.query(
      `SELECT r.* FROM recipes r
       LEFT JOIN users u ON r.author_id = u.id
       WHERE r.author_id IS NULL OR u.id IS NULL`
    );
    res.json(results.rows);
  } catch (err) {
    console.error('Orphaned recipes error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 5) Admin: reassign recipe author
router.post('/admin/recipes/:id/assign-author', authenticateToken, authorizeAdmin, [
  param('id').isUUID().withMessage('recipe id must be UUID'),
  body('author_id').isUUID().withMessage('author_id must be UUID'),
  validationHandler
], async (req, res) => {
  const recipeId = req.params.id;
  const { author_id } = req.body;
  try {
    // ensure target user exists
    const u = await pool.query('SELECT id FROM users WHERE id = $1', [author_id]);
    if (!u.rows.length) return res.status(404).json({ message: 'Target user not found' });

    await pool.query('UPDATE recipes SET author_id = $1 WHERE id = $2', [author_id, recipeId]);
    res.json({ message: 'Recipe author updated' });
  } catch (err) {
    console.error('Assign author error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;