const Database = require('better-sqlite3');
const db = new Database('app.db');

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone_number TEXT,
    role TEXT DEFAULT 'user'
  );
`);

// Create community groups table
db.exec(`
  CREATE TABLE IF NOT EXISTS community_group (
    group_id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_name TEXT NOT NULL,
    description TEXT
  );
`);

// Create group membership table
db.exec(`
  CREATE TABLE IF NOT EXISTS group_membership (
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    join_date TEXT NOT NULL,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES community_group(group_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  );
`);

// Create incident reports table with group_id FK
db.exec(`
  CREATE TABLE IF NOT EXISTS incident_report (
    report_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    group_id INTEGER,
    incident_type TEXT,
    description TEXT,
    location TEXT,
    date_time TEXT,
    status TEXT DEFAULT 'pending',
    photo TEXT,
    video TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (group_id) REFERENCES community_group(group_id)
  );
`);

module.exports = db;
