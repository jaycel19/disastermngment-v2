const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all hotlines
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM hotlines
      ORDER BY hotline_id ASC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error('Get hotlines error:', err);

    res.status(500).json({
      error: 'Failed to retrieve hotlines'
    });
  }
});

// ADD hotline
router.post('/', async (req, res) => {
  const {
    label,
    phone_number,
    location,
    latitude,
    longitude
  } = req.body;

  if (!label || !location || !latitude || !longitude) {
    return res.status(400).json({
      error: 'Missing required fields'
    });
  }

  try {
    const result = await pool.query(`
      INSERT INTO hotlines
      (
        label,
        phone_number,
        location,
        latitude,
        longitude
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING hotline_id
    `, [
      label,
      phone_number || null,
      location,
      latitude,
      longitude
    ]);

    res.status(201).json({
      message: 'Hotline added successfully',
      hotline_id: result.rows[0].hotline_id
    });

  } catch (err) {
    console.error('Add hotline error:', err);

    res.status(500).json({
      error: 'Failed to add hotline'
    });
  }
});

// UPDATE hotline
router.put('/:id', async (req, res) => {
  const { id } = req.params;

  const {
    label,
    phone_number,
    location,
    latitude,
    longitude
  } = req.body;

  if (!label || !location || !latitude || !longitude) {
    return res.status(400).json({
      error: 'Missing required fields'
    });
  }

  try {
    const result = await pool.query(`
      UPDATE hotlines
      SET
        label = $1,
        phone_number = $2,
        location = $3,
        latitude = $4,
        longitude = $5
      WHERE hotline_id = $6
      RETURNING hotline_id
    `, [
      label,
      phone_number || null,
      location,
      latitude,
      longitude,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Hotline not found'
      });
    }

    res.json({
      message: 'Hotline updated successfully'
    });

  } catch (err) {
    console.error('Update hotline error:', err);

    res.status(500).json({
      error: 'Failed to update hotline'
    });
  }
});

// DELETE hotline
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      DELETE FROM hotlines
      WHERE hotline_id = $1
      RETURNING hotline_id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Hotline not found'
      });
    }

    res.json({
      message: 'Hotline deleted successfully'
    });

  } catch (err) {
    console.error('Delete hotline error:', err);

    res.status(500).json({
      error: 'Failed to delete hotline'
    });
  }
});

// GET nearby hotlines
router.get('/nearby', async (req, res) => {
  const {
    lat,
    lng,
    radius = 5
  } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({
      error: 'Missing coordinates'
    });
  }

  try {
    const result = await pool.query(`
      SELECT *,
      (
        6371 * acos(
          cos(radians($1)) *
          cos(radians(latitude)) *
          cos(radians(longitude) - radians($2)) +
          sin(radians($1)) *
          sin(radians(latitude))
        )
      ) AS distance_km

      FROM hotlines

      WHERE latitude IS NOT NULL
      AND longitude IS NOT NULL

      ORDER BY distance_km ASC
    `, [
      lat,
      lng
    ]);

    const nearby = result.rows.filter(
      h => parseFloat(h.distance_km) <= parseFloat(radius)
    );

    res.json(nearby);

  } catch (err) {
    console.error('Nearby hotlines error:', err);

    res.status(500).json({
      error: 'Failed to fetch nearby hotlines'
    });
  }
});

module.exports = router;