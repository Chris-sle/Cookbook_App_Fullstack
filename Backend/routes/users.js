const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const { body } = require('express-validator');
const validationHandler = require('../middleware/validationHandler');
const authenticateToken = require('../middleware/auth');
const generateUniqueUUIDForTable = require('../middleware/generateUUID');
const emailHelpers = require('../lib/emailHelpers');
const { createAndSendConfirmation } = emailHelpers;


// POST /users/register
router.post(
  '/register',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    validationHandler,
    
  ],
  async (req, res) => {
    const { username, email, password } = req.body;
    const id = await generateUniqueUUIDForTable('users');
    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // insert user
        const newUserRes = await client.query(
          'INSERT INTO users (id, username, email, password) VALUES ($1, $2, $3, $4) RETURNING id, email',
          [id, username, email, hashedPassword]
        );
        
        const userId = newUserRes.rows[0].id;
        const userEmail = newUserRes.rows[0].email;

        // create confirmation token and send email
        await createAndSendConfirmation(client, userId, userEmail);

        await client.query('COMMIT');

        return res.json({ message: 'User registered', user_id: userId });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => { });
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Edit user details
// PUT /users/:id
router.put(
  '/:id',
  [
    body('email').isEmail().optional().withMessage('A valid email is required'),
    body('password').isLength({ min: 6 }).optional().withMessage('Password must be at least 6 characters long'),
    validationHandler,
    authenticateToken
  ],
  async (req, res) => {
    const { id } = req.params;
    const { email, password } = req.body;

    try {
      if (email) {
        await pool.query('UPDATE users SET email = $1 WHERE id = $2', [email, id]);
      }

      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
      }

      res.json({ message: 'User updated' });
    } catch (err) {
      console.error('Update user error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Change user password
// POST /users/:id/change-password
router.post(
  '/:id/change-password',
  authenticateToken,
  [
    body('oldPassword').notEmpty().withMessage('Old password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long'),
    validationHandler
  ],
  async (req, res) => {
    const requesterId = req.user && req.user.user_id;
    const { id } = req.params;
    if (requesterId !== id) return res.status(403).json({ message: 'Forbidden' });

    const { oldPassword, newPassword } = req.body;
    try {
      const r = await pool.query('SELECT password FROM users WHERE id = $1', [id]);
      if (!r.rows.length) return res.status(404).json({ message: 'User not found' });
      const hashed = r.rows[0].password;
      const ok = await bcrypt.compare(oldPassword, hashed);
      if (!ok) return res.status(401).json({ message: 'Old password incorrect' });

      const newHashed = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newHashed, id]);

      res.json({ message: 'Password changed' });
    } catch (err) {
      console.error('Change password error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// DELETE /users/:id
router.post(
  '/:id/delete',
  authenticateToken,
  async (req, res) => {
    const requesterId = req.user && req.user.user_id;
    const { id } = req.params;
    if (requesterId !== id) return res.status(403).json({ message: 'Forbidden' });

    try {
      const now = new Date();
      const scheduled = new Date(now);
      const DELETION_GRACE_DAYS = parseInt(process.env.DELETION_GRACE_DAYS || '30', 10);
      scheduled.setDate(scheduled.getDate() + DELETION_GRACE_DAYS);

      await pool.query(
        `UPDATE users
         SET status = $1, deletion_requested_at = $2, deletion_scheduled_at = $3
         WHERE id = $4`,
        ['pending_deletion', now, scheduled, id]
      );

      // optionally send notification email
      res.json({ message: 'Account deletion scheduled', deletion_scheduled_at: scheduled.toISOString() });
    } catch (err) {
      console.error('Delete account error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Reactivate deleted user account
// POST /users/:id/reactivate
router.post(
  '/:id/reactivate',
  authenticateToken,
  async (req, res) => {
    const requesterId = req.user && req.user.user_id;
    const { id } = req.params;
    if (requesterId !== id) return res.status(403).json({ message: 'Forbidden' });

    try {
      const r = await pool.query('SELECT deletion_scheduled_at FROM users WHERE id = $1', [id]);
      if (!r.rows.length) return res.status(404).json({ message: 'User not found' });
      const scheduled = r.rows[0].deletion_scheduled_at;
      if (!scheduled) return res.status(400).json({ message: 'No deletion scheduled' });

      const now = new Date();
      if (new Date(scheduled) < now) {
        return res.status(400).json({ message: 'Deletion already executed or expired' });
      }

      await pool.query(
        `UPDATE users
         SET status = $1, deletion_requested_at = NULL, deletion_scheduled_at = NULL
         WHERE id = $2`,
        ['active', id]
      );

      res.json({ message: 'Account reactivated' });
    } catch (err) {
      console.error('Reactivate error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;