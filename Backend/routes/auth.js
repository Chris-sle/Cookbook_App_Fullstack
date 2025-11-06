const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { body, param } = require('express-validator');
const validationHandler = require('../middleware/validationHandler');


// Helper function to create a secure random refresh token
function createRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

// POST /auth/login
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validationHandler
  ],
  async (req, res) => {
    const { username, password } = req.body;
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id, username, password, is_admin FROM users WHERE username = $1',
        [username]
      );
      if (result.rows.length === 0) return res.status(401).json({ message: 'Invalid username' });

      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.status(401).json({ message: 'Invalid password' });

      const accessToken = jwt.sign(
        { user_id: user.id, username: user.username, is_admin: user.is_admin },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const refreshToken = createRefreshToken();
      const refreshExp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await client.query(
        'INSERT INTO refresh_tokens (user_id, token, user_agent, ip, expires_at) VALUES ($1,$2,$3,$4,$5)',
        [user.id, refreshToken, req.get('User-Agent') || null, req.ip || null, refreshExp]
      );

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: refreshExp
      });

      console.log('Sending token:', accessToken);
      return res.json({
        accessToken,
        user: { id: user.id, username: user.username, is_admin: user.is_admin }
      });
    } catch (err) {
      console.error('Login error:', err); //debugging
      res.status(500).json({ message: 'Server error' });
    } finally {
      client.release();
    }
  }
);

// POST /auth/logout
router.post('/logout', async (req, res, next) => {
  const token = req.cookies && req.cookies.refreshToken;
  try {
    if (token) await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

// POST /auth/refresh
router.post('/refresh', async (req, res, next) => {
  const refreshToken = req.cookies ? req.cookies.refreshToken : null;
  if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

  const client = await pool.connect();
  try {
    const r = await client.query('SELECT user_id, expires_at FROM refresh_tokens WHERE token = $1', [refreshToken]);
    if (r.rows.length === 0) return res.status(401).json({ message: 'Invalid refresh token' });

    const row = r.rows[0];
    if (new Date(row.expires_at) < new Date()) {
      await client.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
      return res.status(401).json({ message: 'Refresh token expired' });
    }

    // Rotate: delete old token, generate a new one
    await client.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    const newRefreshToken = createRefreshToken();
    const refreshExp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await client.query(
      'INSERT INTO refresh_tokens (user_id, token, user_agent, ip, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [row.user_id, newRefreshToken, req.get('User-Agent') || null, req.ip || null, refreshExp]
    );

    const userRes = await client.query('SELECT id, username, is_admin FROM users WHERE id = $1', [row.user_id]);
    const user = userRes.rows[0];

    const accessToken = jwt.sign(
      { user_id: user.id, username: user.username, is_admin: user.is_admin },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Set new refresh token cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: refreshExp
    });

    res.json({ accessToken });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
});

// GET /auth/confirm?token=...
router.get('/confirm', async (req, res, next) => {
  const token = String(req.query.token || '').trim();
  if (!token) return res.status(400).send('Missing token');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `SELECT user_id, expires_at FROM user_confirmations WHERE token = $1`,
      [token]
    );
    if (r.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).send('Invalid confirmation token');
    }
    const row = r.rows[0];
    if (new Date(row.expires_at) < new Date()) {
      await client.query('DELETE FROM user_confirmations WHERE token = $1', [token]);
      await client.query('COMMIT');
      return res.status(400).send('Confirmation token expired');
    }

    await client.query('UPDATE users SET is_confirmed = true WHERE id = $1', [row.user_id]);
    await client.query('DELETE FROM user_confirmations WHERE token = $1', [token]);
    await client.query('COMMIT');
    return res.send('Account confirmed. You may now log in.');
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;