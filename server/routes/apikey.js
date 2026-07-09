const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

// Middleware to verify API key
const verifyApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ message: 'API key required' });
  }

  try {
    const result = await db.query(
      'SELECT api_keys.*, users.name, users.email FROM api_keys JOIN users ON api_keys.user_id = users.id WHERE api_keys.key = $1',
      [apiKey]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid API key' });
    }

    // Update last used timestamp
    await db.query(
      'UPDATE api_keys SET last_used = NOW() WHERE key = $1',
      [apiKey]
    );

    req.user = result.rows[0];
    next();

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Generate API key
router.post('/generate', async (req, res) => {
  const { email, name } = req.body;

  try {
    // Find user
    const userResult = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Generate unique API key
    const apiKey = `kf_${uuidv4().replace(/-/g, '')}`;

    // Store in database
    await db.query(
      'INSERT INTO api_keys (user_id, key, name) VALUES ($1, $2, $3)',
      [user.id, apiKey, name || 'Default Key']
    );

    res.status(201).json({
      message: 'API key generated successfully',
      apiKey,
      name: name || 'Default Key'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Protected route using API key
router.get('/data', verifyApiKey, (req, res) => {
  res.json({
    message: 'Access granted via API key',
    user: {
      name: req.user.name,
      email: req.user.email
    },
    keyName: req.user.name,
    lastUsed: req.user.last_used
  });
});

// List all keys for a user
router.get('/keys/:email', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT api_keys.id, api_keys.name, api_keys.key, api_keys.created_at, api_keys.last_used FROM api_keys JOIN users ON api_keys.user_id = users.id WHERE users.email = $1',
      [req.params.email]
    );

    res.json({ keys: result.rows });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Revoke API key
router.delete('/revoke/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM api_keys WHERE id = $1', [req.params.id]);
    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = { router, verifyApiKey };