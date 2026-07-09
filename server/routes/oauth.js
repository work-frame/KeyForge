const express = require('express');
const router = express.Router();
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const db = require('../config/db');

// Configure GitHub Strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.GITHUB_CALLBACK_URL
},
async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user exists
    const existingUser = await db.query(
      'SELECT * FROM users WHERE github_id = $1',
      [profile.id]
    );

    if (existingUser.rows.length > 0) {
      return done(null, existingUser.rows[0]);
    }

    // Create new user from GitHub profile
    const newUser = await db.query(
      `INSERT INTO users (name, email, github_id, avatar) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [
        profile.displayName || profile.username,
        profile.emails?.[0]?.value || `${profile.username}@github.com`,
        profile.id,
        profile.photos?.[0]?.value
      ]
    );

    return done(null, newUser.rows[0]);

  } catch (error) {
    return done(error, null);
  }
}));

// Serialize and deserialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    done(null, result.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

// Initiate GitHub OAuth
router.get('/github', passport.authenticate('github', {
  scope: ['user:email']
}));

// GitHub callback
router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/oauth/failed' }),
  (req, res) => {
    res.json({
      message: 'OAuth login successful',
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
        github_id: req.user.github_id
      }
    });
  }
);

// OAuth failed
router.get('/failed', (req, res) => {
  res.status(401).json({ message: 'OAuth authentication failed' });
});

// Get current OAuth user
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  res.json({ user: req.user });
});

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ message: 'Logout failed' });
    res.json({ message: 'Logged out successfully' });
  });
});

module.exports = router;