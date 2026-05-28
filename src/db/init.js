const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = path.join(process.cwd(), 'data.db')
let db

function getDb() {
  if (!db) {
    db = new Database(DB_PATH)
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

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT,
        location_gps TEXT,
        date TEXT NOT NULL,
        total_carbon_kg REAL DEFAULT 0,
        participant_count INTEGER DEFAULT 0,
        tree_count INTEGER DEFAULT 0,
        story_c TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

      CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY,
        tree_id TEXT REFERENCES trees(id),
        event_id TEXT REFERENCES events(id),
        story_type TEXT NOT NULL,
        markdown TEXT NOT NULL,
        summary TEXT,
        weather_snapshot TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_stories_tree ON stories(tree_id);
      CREATE INDEX IF NOT EXISTS idx_stories_event ON stories(event_id);
      CREATE INDEX IF NOT EXISTS idx_stories_type ON stories(story_type);

      CREATE TABLE IF NOT EXISTS event_comments (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id),
        participant_token TEXT NOT NULL,
        nickname TEXT,
        content TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_comments_event ON event_comments(event_id);
    `)

    // 新增欄位（若不存在）
    try { db.exec(`ALTER TABLE trees ADD COLUMN reference_used INTEGER DEFAULT 0`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN reference_type TEXT`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN original_dbh_cm REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN applied_correction_factor REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN event_id TEXT REFERENCES events(id)`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN video_filename TEXT`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN video_original_name TEXT`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN video_drive_url TEXT`) } catch(_) {}
    // §27 三路徑並列
    try { db.exec(`ALTER TABLE trees ADD COLUMN path0_dbh_cm REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN pathA_dbh_cm REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN pathB_dbh_cm REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN pathB_dbh_cm_corrected REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN path0_volume_m3 REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN pathA_volume_m3 REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN pathB_volume_m3 REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN path0_carbon_kg REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN pathA_carbon_kg REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN pathB_carbon_kg REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN winner_path TEXT`) } catch(_) {}
    // §27.5 CF per-path
    try { db.exec(`ALTER TABLE correction_factor_log ADD COLUMN path TEXT DEFAULT 'B'`) } catch(_) {}

    // §27.7.5 元數據完整封存（補完支柱一原始設計）
    try { db.exec(`ALTER TABLE trees ADD COLUMN create_date INTEGER`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN frame_rate REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN image_width INTEGER`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN image_height INTEGER`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN altitude_m REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN illuminance_lux REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN duration_sec REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN video_codec TEXT`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN orientation TEXT`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN gps_img_direction_deg REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN device_pressure_hpa REAL`) } catch(_) {}
    try { db.exec(`ALTER TABLE trees ADD COLUMN device_ambient_temp_c REAL`) } catch(_) {}

    // §28 環境快照（每棵樹拍攝瞬間的完整環境）
    db.exec(`
      CREATE TABLE IF NOT EXISTS environmental_context (
        id TEXT PRIMARY KEY,
        tree_id TEXT NOT NULL REFERENCES trees(id),
        measured_at INTEGER NOT NULL,
        lat REAL, lon REAL, altitude_m REAL,
        season TEXT,
        forest_zone TEXT,
        temp_c REAL,
        humidity_pct REAL,
        pressure_hpa REAL,
        wind_dir_deg REAL,
        wind_speed_ms REAL,
        weather_code INTEGER,
        weather_text TEXT,
        precip_mm REAL,
        cloud_cover_pct REAL,
        uv_index REAL,
        sunshine_duration_h REAL,
        shortwave_radiation_wm2 REAL,
        sunrise INTEGER,
        sunset INTEGER,
        day_length_h REAL,
        solar_elevation_deg REAL,
        solar_azimuth_deg REAL,
        phenology_tags TEXT,
        raw_openmeteo_json TEXT,
        raw_cwa_json TEXT,
        fetched_at INTEGER DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_envctx_tree ON environmental_context(tree_id);

      CREATE TABLE IF NOT EXISTS frame_analyses (
        id TEXT PRIMARY KEY,
        tree_id TEXT NOT NULL REFERENCES trees(id),
        frame_idx INTEGER NOT NULL,
        direct_measurement_cm REAL,
        direct_confidence REAL,
        measurement_type TEXT,
        reference_detected INTEGER,
        reference_at_trunk INTEGER,
        reference_type TEXT,
        reference_width_mm REAL,
        reference_height_mm REAL,
        reference_confidence REAL,
        trunk_width_fraction REAL,
        reference_width_fraction REAL,
        reference_height_fraction REAL,
        breast_height_visible INTEGER,
        leaf_visible INTEGER,
        frame_quality_label TEXT,
        raw_json TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        UNIQUE (tree_id, frame_idx)
      );
      CREATE INDEX IF NOT EXISTS idx_frame_analyses_tree ON frame_analyses(tree_id);
    `)

    try { db.exec(`ALTER TABLE trees ADD COLUMN tmp_frames_dir TEXT;`) } catch (_) {}

    // §30 人工皮尺實量（與 actual_dbh_cm 區分；後者是 path 0/A 系統自填，供 CF 訓練用）
    try { db.exec(`ALTER TABLE ground_truth ADD COLUMN manual_dbh_cm REAL;`) } catch (_) {}
    try { db.exec(`ALTER TABLE ground_truth ADD COLUMN measured_by TEXT;`) } catch (_) {}
    try { db.exec(`ALTER TABLE ground_truth ADD COLUMN measured_at INTEGER;`) } catch (_) {}
    try { db.exec(`ALTER TABLE ground_truth ADD COLUMN notes TEXT;`) } catch (_) {}

    // §30.2 evaluation_runs 標記評估路徑（path0/pathA/pathB/final）
    try { db.exec(`ALTER TABLE evaluation_runs ADD COLUMN path TEXT;`) } catch (_) {}

    // §34 frame_analyses 卡片正交過濾欄位
    try { db.exec(`ALTER TABLE frame_analyses ADD COLUMN reference_orthogonal INTEGER;`) } catch (_) {}
    try { db.exec(`ALTER TABLE frame_analyses ADD COLUMN reference_fully_visible INTEGER;`) } catch (_) {}
  }
  return db
}

module.exports = { getDb }
