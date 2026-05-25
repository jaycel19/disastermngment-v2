const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
  ? { rejectUnauthorized: false }
  : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      expo_push_token TEXT,
      phone_number TEXT,
      address TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      role TEXT DEFAULT 'user',
      profile_image TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hotlines (
      hotline_id SERIAL PRIMARY KEY,
      label TEXT NOT NULL,
      phone_number TEXT,
      location TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS resources (
      resource_id SERIAL PRIMARY KEY,
      resource_name TEXT NOT NULL,
      availability TEXT,
      city TEXT,
      contact_number TEXT,
      category TEXT CHECK(category IN ('food', 'shelter', 'medic', 'transpo')) NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_group (
      group_id SERIAL PRIMARY KEY,
      group_name TEXT NOT NULL,
      description TEXT,
      location TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_membership (
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(group_id, user_id),
      FOREIGN KEY(group_id) REFERENCES community_group(group_id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS incident_report (
      report_id SERIAL PRIMARY KEY,
      user_id INTEGER,
      group_id INTEGER,
      incident_type TEXT,
      description TEXT,
      location TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      photo TEXT,
      video TEXT,
      video_thumbnail TEXT,
      responder_id INTEGER,
      is_assigned INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(user_id),
      FOREIGN KEY(group_id) REFERENCES community_group(group_id),
      FOREIGN KEY(responder_id) REFERENCES users(user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      report_id INTEGER,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(user_id),
      FOREIGN KEY(report_id) REFERENCES incident_report(report_id)
    );
  `);

  console.log('PostgreSQL connected');
}

initDB();

module.exports = pool;