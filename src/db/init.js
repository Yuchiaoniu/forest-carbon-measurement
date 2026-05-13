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

      CREATE TABLE IF NOT EXISTS ground_truth (
        id TEXT PRIMARY KEY,
        tree_id TEXT REFERENCES trees(id),
        actual_dbh_cm REAL NOT NULL,
        estimated_dbh_cm REAL,
        correction_factor REAL,
        source TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_ground_truth_tree ON ground_truth(tree_id);

      CREATE TABLE IF NOT EXISTS correction_factor_log (
        id TEXT PRIMARY KEY,
        species TEXT NOT NULL,
        factor REAL NOT NULL,
        sample_count INTEGER NOT NULL,
        std_dev REAL,
        triggered_by TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_cfl_species ON correction_factor_log(species);

      CREATE TABLE IF NOT EXISTS blockchain_jobs (
        id TEXT PRIMARY KEY,
        tree_id TEXT NOT NULL REFERENCES trees(id),
        tx_status TEXT DEFAULT 'pending',
        tx_hash TEXT,
        retry_count INTEGER DEFAULT 0,
        last_attempted_at INTEGER,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_bj_status ON blockchain_jobs(tx_status);
      CREATE INDEX IF NOT EXISTS idx_bj_tree ON blockchain_jobs(tree_id);

      CREATE TABLE IF NOT EXISTS evaluation_runs (
        id TEXT PRIMARY KEY,
        sample_count INTEGER NOT NULL,
        mae REAL,
        mape REAL,
        rmse REAL,
        r2 REAL,
        bias REAL,
        mae_ci_low REAL,
        mae_ci_high REAL,
        mape_ci_low REAL,
        mape_ci_high REAL,
        species_filter TEXT,
        notes TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );
    `)

    // 新增欄位（若不存在）
    try { db.exec(`ALTER TABLE trees ADD COLUMN reference_used INTEGER DEFAULT 0`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN reference_type TEXT`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN original_dbh_cm REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN applied_correction_factor REAL`) } catch(_) {}
  }
  return db
}

module.exports = { getDb }
