// auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;
const refreshTokens = new Set();

// REGISTER
router.post('/register', async (req, res) => {
  const { name, email, password, phone_number, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password, phone_number, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(name, email, hashedPassword, phone_number || null, role || 'user');
    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    res.status(400).json({ error: 'Registration failed', details: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const stmt = db.prepare(`SELECT * FROM users WHERE email = ?`);
    const user = stmt.get(email);

    if (!user) {
      console.log('User not found for email:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      console.log('Password mismatch for user:', user.email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { password: _, ...userData } = user;

    const accessToken = jwt.sign(
      { id: user.user_id, role: user.role },
      ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: user.user_id, role: user.role },
      REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    refreshTokens.add(refreshToken);

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: userData
    });
  } catch (err) {
    console.error('Login error:', err);
    console.log('JWT_SECRET:', process.env.JWT_SECRET);
    console.log('JWT_SECRET:', process.env.JWT_REFRESH_SECRET);
    res.status(500).json({ error: 'Login failed' });
  }
});


// REFRESH TOKEN
router.post('/token', (req, res) => {
  const { token } = req.body;
  if (!token || !refreshTokens.has(token)) {
    return res.status(403).json({ error: 'Refresh token invalid or missing' });
  }

  try {
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET);
    const accessToken = jwt.sign(
      { id: payload.id, role: payload.role },
      ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );
    res.json({ accessToken });
  } catch (err) {
    res.status(403).json({ error: 'Invalid refresh token' });
  }
});

// LOGOUT
router.post('/logout', (req, res) => {
  const { token } = req.body;
  refreshTokens.delete(token);
  res.json({ message: 'Logged out' });
});

module.exports = router;