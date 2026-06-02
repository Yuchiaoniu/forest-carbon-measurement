const { getDb } = require('./init')
const { randomUUID } = require('crypto')

function insert(record) {
  const id = randomUUID()
  getDb().prepare(`
    INSERT INTO environmental_context (
      id, tree_id, measured_at, lat, lon, altitude_m,
      season, forest_zone,
      temp_c, humidity_pct, pressure_hpa,
      wind_dir_deg, wind_speed_ms,
      weather_code, weather_text, precip_mm, cloud_cover_pct,
      uv_index, sunshine_duration_h, shortwave_radiation_wm2,
      sunrise, sunset, day_length_h,
      solar_elevation_deg, solar_azimuth_deg,
      phenology_tags, raw_openmeteo_json, raw_cwa_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, record.treeId, record.measuredAt,
    record.lat ?? null, record.lon ?? null, record.altitudeM ?? null,
    record.season ?? null, record.forestZone ?? null,
    record.tempC ?? null, record.humidityPct ?? null, record.pressureHpa ?? null,
    record.windDirDeg ?? null, record.windSpeedMs ?? null,
    record.weatherCode ?? null, record.weatherText ?? null,
    record.precipMm ?? null, record.cloudCoverPct ?? null,
    record.uvIndex ?? null, record.sunshineDurationH ?? null, record.shortwaveRadiationWm2 ?? null,
    record.sunrise ?? null, record.sunset ?? null, record.dayLengthH ?? null,
    record.solarElevationDeg ?? null, record.solarAzimuthDeg ?? null,
    record.phenologyTags ? JSON.stringify(record.phenologyTags) : null,
    record.rawOpenmeteoJson ? JSON.stringify(record.rawOpenmeteoJson) : null,
    record.rawCwaJson ? JSON.stringify(record.rawCwaJson) : null
  )
  return id
}

function getByTreeId(treeId) {
  const row = getDb().prepare('SELECT * FROM environmental_context WHERE tree_id = ? ORDER BY fetched_at DESC LIMIT 1').get(treeId)
  if (!row) return null
  // 反序列化 JSON 欄位
  try { row.phenology_tags = row.phenology_tags ? JSON.parse(row.phenology_tags) : [] } catch (_) { row.phenology_tags = [] }
  return row
}

module.exports = { insert, getByTreeId }
