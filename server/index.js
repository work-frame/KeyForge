const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const morgan = require('morgan');
const dotenv = require('dotenv');
const db = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware (ALWAYS before routes)
app.use(morgan('dev'));
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  store: new pgSession({
    pool: db,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Routes (ALWAYS after middleware)
const authRoutes = require('./routes/auth');
const { router: apiKeyRoutes } = require('./routes/apikey');

app.use('/auth', authRoutes);
app.use('/apikey', apiKeyRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'KeyForge API is running 🔑' });
});

// Start server
app.listen(PORT, () => {
  console.log(`KeyForge server running on port ${PORT}`);
});