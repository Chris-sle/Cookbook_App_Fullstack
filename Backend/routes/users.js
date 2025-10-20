const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const { body } = require('express-validator');
const validationHandler = require('../middleware/validationHandler');
const authenticateToken = require('../middleware/auth');


// POST /users/register
router.post(
  '/register',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    validationHandler
  ],
  async (req, res) => {
    const { username, email, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await pool.query(
        'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id',
        [username, email, hashedPassword]
      );
      res.json({ message: 'User registered', user_id: newUser.rows[0].id });
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

text

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

// DELETE /users/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const requesterId = req.user && req.user.user_id;
  const isAdmin = req.user && req.user.is_admin;
  if (!isAdmin && Number(requesterId) !== Number(id)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;