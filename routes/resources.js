const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// ➕ ADD new resource
router.post('/resources', auth, async (req, res) => {
  const {
    resource_name,
    availability,
    city,
    contact_number,
    category
  } = req.body;

  if (!resource_name || !city || !contact_number || !category) {
    return res.status(400).json({
      error: 'Missing required fields'
    });
  }

  try {
    const result = await pool.query(`
      INSERT INTO resources
      (
        resource_name,
        availability,
        city,
        contact_number,
        category
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING resource_id
    `, [
      resource_name,
      availability || null,
      city,
      contact_number,
      category.toLowerCase()
    ]);

    res.status(201).json({
      message: 'Resource added',
      resource_id: result.rows[0].resource_id
    });

  } catch (err) {
    console.error('Add resource error:', err);

    res.status(500).json({
      error: 'Failed to add resource'
    });
  }
});

// 🛠️ UPDATE resource
router.put('/resources/:id', auth, async (req, res) => {
  const { id } = req.params;

  const {
    resource_name,
    availability,
    city,
    contact_number,
    category
  } = req.body;

  if (!resource_name || !city || !contact_number || !category) {
    return res.status(400).json({
      error: 'Missing required fields'
    });
  }

  try {
    const result = await pool.query(`
      UPDATE resources
      SET
        resource_name = $1,
        availability = $2,
        city = $3,
        contact_number = $4,
        category = $5
      WHERE resource_id = $6
      RETURNING resource_id
    `, [
      resource_name,
      availability || null,
      city,
      contact_number,
      category.toLowerCase(),
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Resource not found'
      });
    }

    res.json({
      message: 'Resource updated successfully'
    });

  } catch (err) {
    console.error('Update resource error:', err);

    res.status(500).json({
      error: 'Failed to update resource'
    });
  }
});

// 📦 GET all resources
router.get('/resources', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM resources
      ORDER BY resource_name ASC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error('Get resources error:', err);

    res.status(500).json({
      error: 'Failed to fetch resources'
    });
  }
});

// 🔎 GET resources by category
router.get('/resources/category/:category', auth, async (req, res) => {
  const { category } = req.params;

  try {
    const result = await pool.query(`
      SELECT *
      FROM resources
      WHERE LOWER(category) = LOWER($1)
      ORDER BY resource_name ASC
    `, [category]);

    res.json(result.rows);

  } catch (err) {
    console.error('Get resources by category error:', err);

    res.status(500).json({
      error: 'Failed to fetch resources by category'
    });
  }
});

// 🧭 GET resources near responder (by city)
router.get('/resources/responder/:user_id', auth, async (req, res) => {
  const { user_id } = req.params;

  try {
    // Get responder city
    const userResult = await pool.query(`
      SELECT city
      FROM users
      WHERE user_id = $1
      AND role = 'responder'
    `, [user_id]);

    const responder = userResult.rows[0];

    if (!responder || !responder.city) {
      return res.status(404).json({
        error: 'Responder or city not found'
      });
    }

    // Get nearby resources
    const resourcesResult = await pool.query(`
      SELECT *
      FROM resources
      WHERE LOWER(city) = LOWER($1)
      ORDER BY resource_name ASC
    `, [responder.city]);

    res.json(resourcesResult.rows);

  } catch (err) {
    console.error('Get responder resources error:', err);

    res.status(500).json({
      error: 'Failed to fetch nearby resources'
    });
  }
});

module.exports = router;