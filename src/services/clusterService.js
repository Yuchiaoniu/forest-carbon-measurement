const { findEvent, create, updateAggregates } = require('../db/events')
const { getDb } = require('../db/init')

// 將 treeId 指派到對應 event（500m + 同自然日），回傳 { eventId, isNew }
function assignToEvent(treeId) {
  const tree = getDb().prepare('SELECT gps, created_at FROM trees WHERE id = ?').get(treeId)
  if (!tree || !tree.gps) return { eventId: null, isNew: false }

  const parts = tree.gps.split(',').map(Number)
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return { eventId: null, isNew: false }
  const [lat, lng] = parts

  // 同一個自然日（依台灣時區 UTC+8）
  const tsSec = tree.created_at
  const dateStr = new Date((tsSec + 8 * 3600) * 1000).toISOString().slice(0, 10)

  let eventId = null
  let isNew = false
  const existing = findEvent(lat, lng, dateStr)

  if (existing) {
    eventId = existing.id
  } else {
    eventId = create({ locationGps: tree.gps, date: dateStr })
    isNew = true
  }

  // 更新 tree.event_id
  getDb().prepare('UPDATE trees SET event_id = ? WHERE id = ?').run(eventId, treeId)
  updateAggregates(eventId)

  return { eventId, isNew }
}

module.exports = { assignToEvent }
