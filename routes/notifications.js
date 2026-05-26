const express = require('express');
const router = express.Router();

const pool = require('../db');
const authenticateToken = require('../middleware/auth');

// GET notifications
router.get('/notifications/unread', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(`
      SELECT
        id,
        report_id,
        title,
        body,
        data,
        is_read,
        created_at

      FROM notifications

      WHERE user_id = $1

      ORDER BY created_at DESC
    `, [user_id]);

    const notifications = result.rows.map(row => {
      let parsedData = {};

      try {
        parsedData = row.data ? JSON.parse(row.data) : {};
      } catch (e) {
        parsedData = {};
      }

      return {
        id: row.id,
        report_id: row.report_id,
        title: row.title,
        body: row.body,
        is_read: row.is_read,
        created_at: row.created_at,
        data: parsedData
      };
    });

    res.json(notifications);

  } catch (err) {
    console.error('Fetch notifications error:', err);

    res.status(500).json({
      error: 'Failed to fetch notifications'
    });
  }
});

// MARK notification as read
router.post('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const notification_id = req.params.id;

    const result = await pool.query(`
      UPDATE notifications
      SET is_read = true
      WHERE id = $1
      AND user_id = $2
      RETURNING id
    `, [
      notification_id,
      user_id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Notification not found or unauthorized'
      });
    }

    res.json({
      message: 'Notification marked as read'
    });

  } catch (err) {
    console.error('Mark notification error:', err);

    res.status(500).json({
      error: 'Failed to mark notification as read'
    });
  }
});

module.exports = router;