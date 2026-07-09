const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set to true in production
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'KeyForge API is running 🔑' });
});

// Start server
app.listen(PORT, () => {
  console.log(`KeyForge server running on port ${PORT}`);
});