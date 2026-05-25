const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('../utils/cloudinary');
const pool = require('../db');

const router = express.Router();

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;

const refreshTokens = new Set();


// =========================
// REGISTER
// =========================
router.post(
  '/register',
  upload.single('profile_image'),
  async (req, res) => {

    try {

      const {
        name,
        email,
        password,
        phone_number,
        role,
        address,
        latitude,
        longitude,
      } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          error: 'Missing required fields'
        });
      }

      // Check existing email
      const existingUser = await pool.query(
        `SELECT user_id FROM users WHERE email = $1`,
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          error: 'Email already exists'
        });
      }

      // Upload image to Cloudinary
      let profileImageUrl = null;

      if (req.file) {

        const base64Image =
          `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

        const uploaded = await cloudinary.uploader.upload(
          base64Image,
          {
            folder: 'disaster-management/profile-images',
          }
        );

        profileImageUrl = uploaded.secure_url;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user
      const result = await pool.query(`
        INSERT INTO users
        (
          name,
          email,
          password,
          phone_number,
          role,
          address,
          latitude,
          longitude,
          profile_image
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING user_id
      `, [
        name,
        email,
        hashedPassword,
        phone_number || null,
        role || 'resident',
        address || null,
        latitude || null,
        longitude || null,
        profileImageUrl
      ]);

      res.status(201).json({
        message: 'User registered successfully',
        user_id: result.rows[0].user_id,
        profile_image: profileImageUrl,
      });

    } catch (err) {

      console.error('Register error:', err);

      res.status(500).json({
        error: 'Registration failed'
      });
    }
  }
);


// =========================
// LOGIN
// =========================
router.post('/login', async (req, res) => {

  try {

    const { email, password } = req.body;

    const result = await pool.query(`
      SELECT *
      FROM users
      WHERE email = $1
    `, [email]);

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    const isPasswordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordMatch) {
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Check responder assignment
    let is_assigned = false;

    if (user.role === 'responder') {

      const assignedResult = await pool.query(`
        SELECT COUNT(*)::INTEGER AS assigned
        FROM incident_report
        WHERE responder_id = $1
        AND is_assigned = 1
      `, [user.user_id]);

      is_assigned =
        assignedResult.rows[0].assigned > 0;
    }

    // Generate JWT
    const accessToken = jwt.sign(
      {
        id: user.user_id,
        role: user.role
      },
      ACCESS_TOKEN_SECRET,
      {
        expiresIn: '15m'
      }
    );

    const refreshToken = jwt.sign(
      {
        id: user.user_id,
        role: user.role
      },
      REFRESH_TOKEN_SECRET,
      {
        expiresIn: '7d'
      }
    );

    refreshTokens.add(refreshToken);

    // Remove password from response
    delete user.password;

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        ...user,
        is_assigned
      }
    });

  } catch (err) {
    console.error('Login error:', err);

    res.status(500).json({
      error: 'Login failed'
    });
  }
});


// =========================
// GET NEAREST RESPONDERS
// =========================
router.get('/responders', async (req, res) => {

  const {
    lat,
    lng,
    limit = 10
  } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({
      error: 'Missing coordinates'
    });
  }

  try {

    const result = await pool.query(`
      SELECT
        user_id,
        name,
        address,
        city,
        latitude,
        longitude,

        (
          (latitude - $1) * (latitude - $1)
          +
          (longitude - $2) * (longitude - $2)
        ) AS distance

      FROM users

      WHERE role = 'responder'
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL

      ORDER BY distance ASC

      LIMIT $3
    `, [
      lat,
      lng,
      limit
    ]);

    res.json(result.rows);

  } catch (err) {
    console.error('Fetch responders error:', err);

    res.status(500).json({
      error: 'Failed to get responders'
    });
  }
});


// =========================
// GET RESPONDER BY ID
// =========================
router.get('/responders/:id', async (req, res) => {

  const { id } = req.params;

  try {

    const result = await pool.query(`
      SELECT
        user_id,
        name,
        phone_number,
        address,
        city,
        latitude,
        longitude,
        profile_image

      FROM users

      WHERE user_id = $1
      AND role = 'responder'
    `, [id]);

    const responder = result.rows[0];

    if (!responder) {
      return res.status(404).json({
        error: 'Responder not found'
      });
    }

    res.json(responder);

  } catch (err) {
    console.error('Get responder error:', err);

    res.status(500).json({
      error: 'Failed to get responder'
    });
  }
});


// =========================
// GET AUTHORITIES
// =========================
router.get('/authorities', async (req, res) => {

  const {
    lat,
    lng,
    limit = 10
  } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({
      error: 'Missing coordinates'
    });
  }

  try {

    const result = await pool.query(`
      SELECT
        user_id,
        name,
        address,
        city,
        latitude,
        longitude,

        (
          (latitude - $1) * (latitude - $1)
          +
          (longitude - $2) * (longitude - $2)
        ) AS distance

      FROM users

      WHERE role = 'authority'
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL

      ORDER BY distance ASC

      LIMIT $3
    `, [
      lat,
      lng,
      limit
    ]);

    res.json(result.rows);

  } catch (err) {
    console.error('Fetch authorities error:', err);

    res.status(500).json({
      error: 'Failed to get authorities'
    });
  }
});


// =========================
// REFRESH TOKEN
// =========================
router.post('/token', (req, res) => {

  const { token } = req.body;

  if (!token || !refreshTokens.has(token)) {
    return res.status(403).json({
      error: 'Refresh token invalid or missing'
    });
  }

  try {

    const payload = jwt.verify(
      token,
      REFRESH_TOKEN_SECRET
    );

    const accessToken = jwt.sign(
      {
        id: payload.id,
        role: payload.role
      },
      ACCESS_TOKEN_SECRET,
      {
        expiresIn: '15m'
      }
    );

    res.json({
      accessToken
    });

  } catch (err) {

    res.status(403).json({
      error: 'Invalid refresh token'
    });
  }
});


// =========================
// LOGOUT
// =========================
router.post('/logout', (req, res) => {

  const { token } = req.body;

  refreshTokens.delete(token);

  res.json({
    message: 'Logged out'
  });
});

const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
});

module.exports = router;