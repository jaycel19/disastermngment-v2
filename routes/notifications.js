const express = require('express');

const router = express.Router();

const pool = require('../db');

const authenticateToken =
  require('../middleware/auth');

// ======================================
// GET Notifications
// ======================================
router.get(
  '/notifications/unread',
  authenticateToken,
  async (req, res) => {

    try {

      const user_id = req.user.id;

      const result = await pool.query(`
        SELECT
          n.id,
          n.report_id,
          n.title,
          n.body,
          n.data,
          n.is_read,
          n.created_at,

          ir.incident_type,
          ir.location,
          ir.status,
          ir.responder_id,

          u.name AS reporter_name

        FROM notifications n

        LEFT JOIN incident_report ir
          ON n.report_id = ir.report_id

        LEFT JOIN users u
          ON ir.user_id = u.user_id

        WHERE n.user_id = $1

        ORDER BY n.created_at DESC
      `, [user_id]);

      const notifications =
        result.rows.map((row) => {

          let parsedData = {};

          try {

            parsedData =
              row.data
                ? JSON.parse(row.data)
                : {};

          } catch (e) {

            parsedData = {};
          }

          return {

            id: row.id,

            report_id:
              row.report_id,

            title:
              row.title,

            body:
              row.body,

            is_read:
              row.is_read,

            created_at:
              row.created_at,

            data: {

              // preserve old payload
              ...parsedData,

              // overwrite with latest DB values
              reporter_name:
                row.reporter_name ||
                parsedData.reporter_name ||
                'Unknown Reporter',

              location:
                row.location ||
                parsedData.location ||
                'Unknown Location',

              incident_type:
                row.incident_type ||
                parsedData.incident_type ||
                'Incident',

              status:
                row.status ||
                parsedData.status ||
                'pending',

              assigned_to_responder_id:
                row.responder_id ||
                parsedData.assigned_to_responder_id ||
                null,
            },
          };
        });

      res.json(notifications);

    } catch (err) {

      console.error(
        'Fetch notifications error:',
        err
      );

      res.status(500).json({
        error:
          'Failed to fetch notifications',
      });
    }
  }
);

// ======================================
// MARK Notification as Read
// ======================================
router.post(
  '/notifications/:id/read',
  authenticateToken,
  async (req, res) => {

    try {

      const user_id =
        req.user.id;

      const notification_id =
        req.params.id;

      const result =
        await pool.query(`
          UPDATE notifications

          SET is_read = true

          WHERE id = $1
          AND user_id = $2

          RETURNING id
        `, [
          notification_id,
          user_id
        ]);

      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          error:
            'Notification not found or unauthorized'
        });
      }

      res.json({
        message:
          'Notification marked as read'
      });

    } catch (err) {

      console.error(
        'Mark notification error:',
        err
      );

      res.status(500).json({
        error:
          'Failed to mark notification as read'
      });
    }
  }
);

module.exports = router;