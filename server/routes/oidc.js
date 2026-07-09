const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Generate ID Token (OIDC style)
const generateIDToken = (user) => {
  return jwt.sign(
    {
      // Standard OIDC claims
      sub: user.github_id || user.id,
      name: user.name,
      email: user.email,
      picture: user.avatar,
      iss: 'http://localhost:5000', // Issuer (our server)
      aud: process.env.GITHUB_CLIENT_ID, // Audience (our app)
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Get ID Token for authenticated user
router.get('/token', async (req, res) => {
  const { email } = req.query;

  try {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];
    const idToken = generateIDToken(user);

    res.json({
      message: 'ID Token generated',
      id_token: idToken,
      token_type: 'Bearer',
      expires_in: 3600
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Userinfo endpoint (standard OIDC endpoint)
router.get('/userinfo', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Return standard OIDC userinfo claims
    res.json({
      sub: decoded.sub,
      name: decoded.name,
      email: decoded.email,
      picture: decoded.picture,
      iss: decoded.iss,
      aud: decoded.aud
    });

  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
});

// Discovery endpoint (standard OIDC endpoint)
router.get('/.well-known/openid-configuration', (req, res) => {
  res.json({
    issuer: 'http://localhost:5000',
    authorization_endpoint: 'http://localhost:5000/oauth/github',
    token_endpoint: 'http://localhost:5000/oidc/token',
    userinfo_endpoint: 'http://localhost:5000/oidc/userinfo',
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['HS256']
  });
});

module.exports = router;