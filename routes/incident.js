const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Upload and compress video/image
router.post('/incident', authenticateToken, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'photo', maxCount: 1 }
]), async (req, res) => {
  const { user_id, incident_type, description, location, date_time, status } = req.body;
  const photoFile = req.files['photo']?.[0];
  const videoFile = req.files['video']?.[0];
  let videoPath = '';
  let photoPath = '';

  try {
    // Move image to permanent location
    if (photoFile) {
      const targetPath = `uploads/${Date.now()}_${photoFile.originalname}`;
      fs.renameSync(photoFile.path, targetPath);
      photoPath = targetPath;
    }

    // Compress video
    if (videoFile) {
      const compressedName = `compressed_${Date.now()}.mp4`;
      const outputPath = `uploads/${compressedName}`;

      await new Promise((resolve, reject) => {
        ffmpeg(videoFile.path)
          .outputOptions(['-vcodec libx264', '-crf 28'])
          .on('end', () => {
            fs.unlinkSync(videoFile.path); // delete original
            resolve();
          })
          .on('error', reject)
          .save(outputPath);
      });

      const stats = fs.statSync(outputPath);
      if (stats.size > 150 * 1024 * 1024) {
        fs.unlinkSync(outputPath);
        return res.status(400).json({ error: 'Compressed video exceeds 150MB limit.' });
      }

      videoPath = outputPath;
    }

    const stmt = db.prepare(`
      INSERT INTO incident_report (
        user_id, incident_type, description, location, date_time, status, photo, video
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(user_id, incident_type, description, location, date_time, status || 'pending', photoPath, videoPath);

    res.status(201).json({ message: 'Incident report created', video: videoPath, photo: photoPath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload and save incident.' });
  }
});

module.exports = router;
