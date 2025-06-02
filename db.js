const Database = require('better-sqlite3');
const db = new Database('app.db');

// Create users table if it doesn't exist
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

db.exec(`
  CREATE TABLE IF NOT EXISTS incident_report (
    report_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    incident_type TEXT,
    description TEXT,
    location TEXT,
    date_time TEXT,
    status TEXT DEFAULT 'pending',
    photo TEXT,
    video TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  );
`);


module.exports = db;
