const express = require('express');
const router = express.Router();

const pool = require('../db');
const multer = require('multer');
const cloudinary = require('../utils/cloudinary');
const authenticateToken = require('../middleware/auth');

const {
  notifyAuthorities,
  sendExpoPushNotification
} = require('../utils/pushNotifHelper');

const upload = multer({
  storage: multer.memoryStorage(),
});



// CREATE incident
router.post(
  '/incident',
  authenticateToken,
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'video_thumbnail', maxCount: 1 },
  ]),
  async (req, res) => {

    try {

      const user_id = req.user.id;

      const {
        group_id,
        incident_type,
        description,
        location,
        latitude,
        longitude,
        date_time,
        status,
      } = req.body;

      let photoUrl = null;
      let videoUrl = null;
      let thumbnailUrl = null;

      // =========================
      // Upload Photo
      // =========================
      if (req.files?.photo?.[0]) {

        const photoFile = req.files.photo[0];

        const base64Photo =
          `data:${photoFile.mimetype};base64,${photoFile.buffer.toString('base64')}`;

        const uploadedPhoto = await cloudinary.uploader.upload(
          base64Photo,
          {
            folder: 'disaster-management/incidents/photos',
          }
        );

        photoUrl = uploadedPhoto.secure_url;
      }

      // =========================
      // Upload Video
      // =========================
      if (req.files?.video?.[0]) {

        const videoFile = req.files.video[0];

        const base64Video =
          `data:${videoFile.mimetype};base64,${videoFile.buffer.toString('base64')}`;

        const uploadedVideo = await cloudinary.uploader.upload(
          base64Video,
          {
            resource_type: 'video',
            folder: 'disaster-management/incidents/videos',
          }
        );

        videoUrl = uploadedVideo.secure_url;
      }

      // =========================
      // Upload Thumbnail
      // =========================
      if (req.files?.video_thumbnail?.[0]) {

        const thumbFile = req.files.video_thumbnail[0];

        const base64Thumb =
          `data:${thumbFile.mimetype};base64,${thumbFile.buffer.toString('base64')}`;

        const uploadedThumb = await cloudinary.uploader.upload(
          base64Thumb,
          {
            folder: 'disaster-management/incidents/thumbnails',
          }
        );

        thumbnailUrl = uploadedThumb.secure_url;
      }

      // =========================
      // Save Incident
      // =========================
      const result = await pool.query(`
        INSERT INTO incident_report
        (
          user_id,
          group_id,
          incident_type,
          description,
          location,
          latitude,
          longitude,
          date_time,
          status,
          photo,
          video,
          video_thumbnail
        )
        VALUES
        (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
        )
        RETURNING report_id
      `, [
        user_id,
        group_id || null,
        incident_type,
        description,
        location,
        latitude,
        longitude,
        date_time || new Date(),
        status || 'pending',
        photoUrl,
        videoUrl,
        thumbnailUrl
      ]);

      const report_id = result.rows[0].report_id;

      // =========================
      // Notify Authorities
      // =========================
      await notifyAuthorities({
        report_id,
        group_id,
        incident_type,
        location,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        status: status || 'pending'
      });

      res.status(201).json({
        message: 'Incident report created',
        report_id,
        photo: photoUrl,
        video: videoUrl,
        video_thumbnail: thumbnailUrl
      });

    } catch (err) {

      console.error('Create incident error:', err);

      res.status(500).json({
        error: 'Failed to create incident'
      });
    }
  }
);

// GET incidents for joined groups
router.get('/incident', authenticateToken, async (req, res) => {

  try {

    const user_id = req.user.id;

    const page = parseInt(req.query.page, 10) || 1;

    const perPage = 10;

    const offset = (page - 1) * perPage;

    const result = await pool.query(`
      SELECT
        ir.*,
        cg.group_name AS community_name,
        u.name AS username,
        u.profile_image

      FROM incident_report ir

      JOIN community_group cg
      ON ir.group_id = cg.group_id

      JOIN users u
      ON ir.user_id = u.user_id

      WHERE ir.group_id IN (
        SELECT group_id
        FROM group_membership
        WHERE user_id = $1
      )

      ORDER BY
        CASE
          WHEN ir.status = 'active' THEN 0
          WHEN ir.status = 'pending' THEN 1
          WHEN ir.status = 'resolved' THEN 2
          ELSE 3
        END,
        ir.date_time DESC

      LIMIT $2
      OFFSET $3
    `, [
      user_id,
      perPage,
      offset
    ]);

    res.json(result.rows);

  } catch (err) {

    console.error('Fetch incidents error:', err);

    res.status(500).json({
      error: 'Failed to retrieve incident reports'
    });
  }
});

// GET single incident
router.get('/incident/:id', async (req, res) => {

  const { id } = req.params;

  try {

    const result = await pool.query(`
      SELECT
        ir.*,
        cg.group_name,
        u.name AS username,
        u.profile_image

      FROM incident_report ir

      JOIN community_group cg
      ON ir.group_id = cg.group_id

      JOIN users u
      ON ir.user_id = u.user_id

      WHERE ir.report_id = $1
    `, [id]);

    const report = result.rows[0];

    if (!report) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    res.json(report);

  } catch (err) {

    console.error('Fetch incident detail error:', err);

    res.status(500).json({
      error: 'Failed to fetch report detail'
    });
  }
});

// ASSIGN responder
router.post('/incident/:id/assign', async (req, res) => {

  const { id } = req.params;

  const { responder_id } = req.body;

  if (!responder_id) {
    return res.status(400).json({
      error: 'Missing responder_id'
    });
  }

  try {

    // Assign responder
    const assignResult = await pool.query(`
      UPDATE incident_report
      SET
        responder_id = $1,
        is_assigned = true
      WHERE report_id = $2
      RETURNING *
    `, [
      responder_id,
      id
    ]);

    const incident = assignResult.rows[0];

    if (!incident) {
      return res.status(404).json({
        error: 'Incident not found'
      });
    }

    // Get responder
    const responderResult = await pool.query(`
      SELECT *
      FROM users
      WHERE user_id = $1
    `, [responder_id]);

    const responder = responderResult.rows[0];

    if (responder?.expo_push_token) {

      const title = '📍 You have been assigned to a new incident';

      const body = `Location: ${incident.location}`;

      const dataPayload = {
        navigateTo: 'Alerts',
        report_id: incident.report_id,
        location: incident.location,
        incident_type: incident.incident_type,
        status: 'assigned',
        assigned_to_responder_id: responder.user_id
      };

      await sendExpoPushNotification(
        responder.expo_push_token,
        title,
        body,
        dataPayload
      );

      await pool.query(`
        INSERT INTO notifications
        (
          user_id,
          report_id,
          title,
          body,
          data
        )
        VALUES ($1,$2,$3,$4,$5)
      `, [
        responder.user_id,
        incident.report_id,
        title,
        body,
        JSON.stringify(dataPayload)
      ]);
    }

    res.json({
      message: 'Responder assigned and notified successfully'
    });

  } catch (err) {

    console.error('Assign responder error:', err);

    res.status(500).json({
      error: 'Failed to assign responder'
    });
  }
});

// GET incidents by user
router.get('/incident/user/:user_id', authenticateToken, async (req, res) => {

  const { user_id } = req.params;

  try {

    const result = await pool.query(`
      SELECT
        ir.*,
        cg.group_name AS community_name,
        u.name AS username,
        u.profile_image

      FROM incident_report ir

      JOIN community_group cg
      ON ir.group_id = cg.group_id

      JOIN users u
      ON ir.user_id = u.user_id

      WHERE ir.user_id = $1

      ORDER BY ir.date_time DESC
    `, [user_id]);

    res.json(result.rows);

  } catch (err) {

    console.error('Fetch user incidents error:', err);

    res.status(500).json({
      error: 'Failed to fetch submitted reports'
    });
  }
});

module.exports = router;