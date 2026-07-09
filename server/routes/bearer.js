const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../config/db');

// Middleware to verify Bearer token
const verifyBearer = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Bearer token required' });
  }

  try {
    const result = await db.query(
      `SELECT user_sessions.*, users.name, users.email 
       FROM user_sessions 
       JOIN users ON user_sessions.user_id = users.id 
       WHERE user_sessions.token = $1 
       AND user_sessions.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    req.user = result.rows[0];
    next();

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Issue bearer token
router.post('/token', async (req, res) => {
  const { email } = req.body;

  try {
    const userResult = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Generate random token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store in database
    await db.query(
      'INSERT INTO user_sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    res.json({
      message: 'Bearer token issued',
      token,
      expiresAt
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Protected route
router.get('/protected', verifyBearer, (req, res) => {
  res.json({
    message: 'Access granted via Bearer token',
    user: {
      name: req.user.name,
      email: req.user.email
    },
    tokenExpires: req.user.expires_at
  });
});

// Revoke token
router.delete('/revoke', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  try {
    await db.query(
      'DELETE FROM user_sessions WHERE token = $1',
      [token]
    );
    res.json({ message: 'Token revoked successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = { router, verifyBearer };