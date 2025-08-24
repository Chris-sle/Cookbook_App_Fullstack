const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const validationHandler = require('../middleware/validationHandler');

// Register a new user
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
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const newUser = await pool.query(
        'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id',
        [username, email, hashedPassword]
      );
      res.json({ message: 'User registered', user_id: newUser.rows[0].id });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// User login
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validationHandler
  ],
  async (req, res) => {
    const { username, password } = req.body;

    try {
      const user = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

      if (user.rows.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.rows[0].password);

      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign({ user_id: user.rows[0].id, is_admin: user.rows[0].is_admin }, process.env.JWT_SECRET, { expiresIn: '1h' });

      res.json({ token });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Edit user
router.put(
  '/:id',
  [
    body('email').isEmail().optional().withMessage('A valid email is required'),
    body('password').isLength({ min: 6 }).optional().withMessage('Password must be at least 6 characters long'),
    validationHandler
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
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Delete user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
