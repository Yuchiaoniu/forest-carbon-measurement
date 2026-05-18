const { getDb } = require('./init')
const { randomUUID } = require('crypto')

// 根據 GPS 和日期查找現有 event（500m 範圍 + 同一天）
function findEvent(lat, lng, dateStr) {
  const rows = getDb().prepare(
    `SELECT * FROM events WHERE date = ? ORDER BY created_at DESC`
  ).all(dateStr)

  for (const row of rows) {
    if (!row.location_gps) continue
    const [eLat, eLng] = row.location_gps.split(',').map(Number)
    if (isNaN(eLat) || isNaN(eLng)) continue
    const dist = haversineKm(lat, lng, eLat, eLng)
    if (dist <= 0.5) return row
  }
  return null
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function create({ locationGps, date, name }) {
  const id = randomUUID()
  const defaultName = name || `造林活動 ${date}`
  getDb().prepare(`
    INSERT INTO events (id, name, location_gps, date)
    VALUES (?, ?, ?, ?)
  `).run(id, defaultName, locationGps, date)
  return id
}

function updateAggregates(eventId) {
  const db = getDb()
  const agg = db.prepare(`
    SELECT COUNT(*) as tree_count,
           SUM(carbon_kg) as total_carbon,
           COUNT(DISTINCT gps) as participant_count
    FROM trees WHERE event_id = ?
  `).get(eventId)
  db.prepare(`
    UPDATE events SET
      tree_count = ?,
      total_carbon_kg = ?,
      participant_count = ?,
      updated_at = unixepoch()
    WHERE id = ?
  `).run(agg.tree_count, agg.total_carbon || 0, agg.participant_count, eventId)
}

function setStoryC(eventId, markdown) {
  getDb().prepare(`UPDATE events SET story_c = ?, updated_at = unixepoch() WHERE id = ?`).run(markdown, eventId)
}

function getById(eventId) {
  return getDb().prepare(`SELECT * FROM events WHERE id = ?`).get(eventId)
}

function getTreesInEvent(eventId) {
  return getDb().prepare(`
    SELECT id, species, dbh_cm, carbon_kg, gps, created_at FROM trees WHERE event_id = ?
  `).all(eventId)
}

module.exports = { findEvent, create, updateAggregates, setStoryC, getById, getTreesInEvent }
