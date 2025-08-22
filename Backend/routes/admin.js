const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeAdmin = require('../middleware/admin');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');

// Admin-only: View all users
router.get('/users', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const users = await pool.query('SELECT id, username, email, is_admin, created_at FROM users');
    res.json(users.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin-only: Delete a user
router.delete('/users/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin-only: Ban a user (set a status, e.g., banned)
router.post('/users/:id/ban', authenticateToken, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE users SET status = $1 WHERE id = $2', ['banned', id]);
    res.json({ message: 'User banned' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin-only: Suspend a user for a specified period
router.post('/users/:id/suspend', authenticateToken, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  const { duration } = req.body; // duration in days
  try {
    const suspendUntil = new Date();
    suspendUntil.setDate(suspendUntil.getDate() + duration);
    await pool.query('UPDATE users SET suspended_until = $1 WHERE id = $2', [suspendUntil, id]);
    res.json({ message: `User suspended for ${duration} days` });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin-only: Logistics (e.g., statistics or other dashboard data, implementation depends on requirements)
router.get('/logistics', authenticateToken, authorizeAdmin, async (req, res) => {
  // Placeholder for gathering statistics or other logistics data
  try {
    const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
    const totalRecipes = await pool.query('SELECT COUNT(*) FROM recipes');
    res.json({
      totalUsers: totalUsers.rows[0].count,
      totalRecipes: totalRecipes.rows[0].count,
      // Add more fields as required
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin-only: Promote an existing user to admin
router.post('/promote/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const userExist = await pool.query('SELECT id FROM users WHERE id = $1', [id]);

    if (userExist.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    await pool.query('UPDATE users SET is_admin = TRUE WHERE id = $1', [id]);
    res.json({ message: 'User promoted to admin' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
