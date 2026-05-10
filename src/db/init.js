const { DatabaseSync } = require('node:sqlite')
const path = require('path')

const DB_PATH = path.join(process.cwd(), 'data.db')
let db

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH)
    db.exec(`PRAGMA journal_mode=WAL;`)
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS plots (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id),
        name TEXT,
        gps TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS trees (
        id TEXT PRIMARY KEY,
        plot_id TEXT REFERENCES plots(id),
        video_hash TEXT UNIQUE,
        species TEXT,
        species_source TEXT,
        dbh_cm REAL,
        volume_m3 REAL,
        carbon_kg REAL,
        confidence TEXT,
        gps TEXT,
        focal_length_mm REAL,
        sensor_width_mm REAL,
        device_model TEXT,
        frame_quality TEXT,
        tx_hash TEXT,
        tx_status TEXT DEFAULT 'pending',
        raw_result TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_trees_video_hash ON trees(video_hash);
      CREATE INDEX IF NOT EXISTS idx_trees_tx_status ON trees(tx_status);
    `)
  }
  return db
}

module.exports = { getDb }
