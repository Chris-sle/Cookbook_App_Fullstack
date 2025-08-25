const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeAdmin = require('../middleware/admin');
const { param, body, query } = require('express-validator');
const validationHandler = require('../middleware/validationHandler');

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
    param('id').isInt().withMessage('User id must be an integer'),
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
    param('id').isInt(),
    validationHandler
  ],
  async (req, res, next) => {
    const targetId = parseInt(req.params.id, 10);
    try {
      await pool.query('UPDATE users SET status=$1 WHERE id=$2', ['banned', targetId]);
      res.json({ message: 'User banned' });
    } catch (err) {
      next(err);
    }
  }
);

/** Suspend a user for given days (optional: suspend_until timestamp) */
router.post(
  '/users/:id/suspend',
  authenticateToken,
  authorizeAdmin,
  [
    param('id').isInt(),
    body('duration').optional().isInt({ min:1 }),
    validationHandler
  ],
  async (req, res, next) => {
    const targetId = parseInt(req.params.id, 10);
    const { duration } = req.body;
    try {
      const suspendUntil = new Date();
      if (duration) {
        suspendUntil.setDate(suspendUntil.getDate() + duration);
      } else {
        suspendUntil.setDate(suspendUntil.getDate() + 1); // default 1 day
      }
      await pool.query('UPDATE users SET suspended_until=$1 WHERE id=$2', [suspendUntil, targetId]);
      res.json({ message: `User suspended until ${suspendUntil}` });
    } catch (err) {
      next(err);
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
    param('id').isInt().withMessage('User ID must be an integer'),
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

module.exports = router;