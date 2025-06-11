const express = require('express');
const db = require('../db');
const router = express.Router();
const auth = require('../middleware/auth');

// GET all community groups
router.get('/community-group', (req, res) => {
  const stmt = db.prepare('SELECT * FROM community_group');
  const groups = stmt.all();
  res.json(groups);
});

// POST create new group
router.post('/community-group', auth, (req, res) => {
  const { group_name, description } = req.body;
  const stmt = db.prepare('INSERT INTO community_group (group_name, description) VALUES (?, ?)');
  const result = stmt.run(group_name, description);
  res.status(201).json({ group_id: result.lastInsertRowid });
});

// JOIN a group
router.post('/community-group/:id/join', auth, (req, res) => {
  const { id: group_id } = req.params;
  const user_id = req.user.id;
  const stmt = db.prepare('INSERT OR IGNORE INTO group_membership (group_id, user_id, join_date) VALUES (?, ?, datetime("now"))');
  stmt.run(group_id, user_id);
  res.json({ message: 'Joined group successfully' });
});

// GET group members
router.get('/community-group/:id/members', (req, res) => {
  const stmt = db.prepare(`
    SELECT u.user_id, u.name, u.email
    FROM group_membership gm
    JOIN users u ON gm.user_id = u.user_id
    WHERE gm.group_id = ?
  `);
  const members = stmt.all(req.params.id);
  res.json(members);
});

module.exports = router;
