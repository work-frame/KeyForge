const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Simulated registered apps that trust KeyForge as their Identity Provider
const TRUSTED_APPS = {
  'app-analytics': {
    name: 'Analytics Dashboard',
    secret: 'analytics-secret-123'
  },
  'app-billing': {
    name: 'Billing Portal',
    secret: 'billing-secret-456'
  },
  'app-admin': {
    name: 'Admin Panel',
    secret: 'admin-secret-789'
  }
};

// Generate SSO token (Identity Provider)
router.post('/login', async (req, res) => {
  const { email } = req.body;

  try {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];

    // Generate SSO token valid across all trusted apps
    const ssoToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        sso: true, // marks this as an SSO token
        apps: Object.keys(TRUSTED_APPS) // apps this token is valid for
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' } // SSO tokens last longer
    );

    res.json({
      message: 'SSO login successful',
      ssoToken,
      validFor: Object.values(TRUSTED_APPS).map(app => app.name),
      expiresIn: '8h'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify SSO token for a specific app (Service Provider)
router.post('/verify', (req, res) => {
  const { token, appId } = req.body;

  if (!TRUSTED_APPS[appId]) {
    return res.status(400).json({ message: 'Unknown application' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.sso) {
      return res.status(401).json({ message: 'Not an SSO token' });
    }

    if (!decoded.apps.includes(appId)) {
      return res.status(403).json({ message: 'Token not valid for this app' });
    }

    res.json({
      message: `Access granted to ${TRUSTED_APPS[appId].name}`,
      user: {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name
      },
      app: TRUSTED_APPS[appId].name,
      tokenExpires: new Date(decoded.exp * 1000)
    });

  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired SSO token' });
  }
});

// List all trusted apps
router.get('/apps', (req, res) => {
  res.json({
    apps: Object.entries(TRUSTED_APPS).map(([id, app]) => ({
      id,
      name: app.name
    }))
  });
});

module.exports = router;