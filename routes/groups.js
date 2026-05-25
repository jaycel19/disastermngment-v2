const express = require('express');
const pool = require('../db');
const router = express.Router();
const auth = require('../middleware/auth');
const { savePushToken } = require('../utils/pushNotifHelper');

// Share a post to another community
router.post('/incident/:id/share', auth, async (req, res) => {
  const { id } = req.params;
  const { target_group_id } = req.body;
  const user_id = req.user.id;

  try {
    // Get original incident
    const incidentResult = await pool.query(
      `SELECT * FROM incident_report WHERE report_id = $1`,
      [id]
    );

    const incident = incidentResult.rows[0];

    if (!incident) {
      return res.status(404).json({
        error: 'Incident not found'
      });
    }

    // Insert shared incident
    const insertResult = await pool.query(`
      INSERT INTO incident_report (
        user_id,
        group_id,
        date_time,
        incident_type,
        location,
        status,
        description,
        photo,
        video,
        video_thumbnail,
        latitude,
        longitude
      )
      VALUES (
        $1,$2,NOW(),$3,$4,$5,$6,$7,$8,$9,$10,$11
      )
      RETURNING report_id
    `, [
      user_id,
      target_group_id,
      incident.incident_type,
      incident.location,
      incident.status,
      incident.description,
      incident.photo,
      incident.video,
      incident.video_thumbnail,
      incident.latitude,
      incident.longitude
    ]);

    res.json({
      message: 'Incident shared',
      new_report_id: insertResult.rows[0].report_id
    });

  } catch (err) {
    console.error('Share incident error:', err);

    res.status(500).json({
      error: 'Failed to share incident'
    });
  }
});

// GET all community groups
router.get('/community-group', auth, async (req, res) => {
  const user_id = req.user.id;

  try {
    const result = await pool.query(`
      SELECT 
        cg.*,

        (
          SELECT COUNT(*)
          FROM group_membership gm
          WHERE gm.group_id = cg.group_id
        )::INTEGER AS members_count,

        EXISTS (
          SELECT 1
          FROM group_membership gm2
          WHERE gm2.group_id = cg.group_id
          AND gm2.user_id = $1
        ) AS joined

      FROM community_group cg
      ORDER BY cg.group_name ASC
    `, [user_id]);

    res.json(result.rows);

  } catch (err) {
    console.error('Fetch groups error:', err);

    res.status(500).json({
      error: 'Failed to fetch community groups'
    });
  }
});

// CREATE community group
router.post('/community-group', auth, async (req, res) => {
  const {
    group_name,
    description,
    location,
    latitude,
    longitude
  } = req.body;

  try {
    const result = await pool.query(`
      INSERT INTO community_group
      (
        group_name,
        description,
        location,
        latitude,
        longitude
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING group_id
    `, [
      group_name,
      description,
      location,
      latitude,
      longitude
    ]);

    res.status(201).json({
      group_id: result.rows[0].group_id
    });

  } catch (err) {
    console.error('Create group error:', err);

    res.status(500).json({
      error: 'Failed to create community group'
    });
  }
});

// JOIN community group
router.post('/community-group/:id/join', auth, async (req, res) => {
  const group_id = req.params.id;
  const user_id = req.user.id;

  try {
    await pool.query(`
      INSERT INTO group_membership
      (
        group_id,
        user_id,
        join_date
      )
      VALUES ($1,$2,NOW())
      ON CONFLICT (group_id, user_id)
      DO NOTHING
    `, [
      group_id,
      user_id
    ]);

    res.json({
      message: 'Joined group successfully'
    });

  } catch (err) {
    console.error('Join group error:', err);

    res.status(500).json({
      error: 'Failed to join group'
    });
  }
});

// GET joined groups
router.get('/community-group/mine', auth, async (req, res) => {
  const user_id = req.user.id;

  try {
    const result = await pool.query(`
      SELECT
        cg.group_id,
        cg.group_name,
        cg.description,
        cg.location,
        cg.latitude,
        cg.longitude

      FROM community_group cg

      JOIN group_membership gm
      ON gm.group_id = cg.group_id

      WHERE gm.user_id = $1

      ORDER BY cg.group_name ASC
    `, [user_id]);

    res.json(result.rows);

  } catch (err) {
    console.error('Fetch joined groups error:', err);

    res.status(500).json({
      error: 'Failed to fetch joined groups'
    });
  }
});

// GET group members
router.get('/community-group/:id/members', async (req, res) => {
  const group_id = req.params.id;

  try {
    const result = await pool.query(`
      SELECT
        u.user_id,
        u.name,
        u.email,
        u.role,
        u.profile_image

      FROM group_membership gm

      JOIN users u
      ON gm.user_id = u.user_id

      WHERE gm.group_id = $1

      ORDER BY u.name ASC
    `, [group_id]);

    res.json(result.rows);

  } catch (err) {
    console.error('Fetch members error:', err);

    res.status(500).json({
      error: 'Failed to fetch group members'
    });
  }
});

// SAVE Expo push token
router.post('/save-token', auth, async (req, res) => {
  const { expo_push_token } = req.body;
  const user_id = req.user.id;

  try {
    await savePushToken(user_id, expo_push_token);

    res.json({
      message: 'Push token saved'
    });

  } catch (err) {
    console.error('Save token error:', err);

    res.status(500).json({
      error: 'Failed to save push token'
    });
  }
});

module.exports = router;