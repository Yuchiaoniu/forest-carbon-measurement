const { getDb } = require('./init')
const { randomUUID } = require('crypto')

function insert({ treeId, eventId, storyType, markdown, summary, weatherSnapshot }) {
  const id = randomUUID()
  getDb().prepare(`
    INSERT INTO stories (id, tree_id, event_id, story_type, markdown, summary, weather_snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, treeId || null, eventId || null, storyType, markdown, summary || null,
    weatherSnapshot ? JSON.stringify(weatherSnapshot) : null)
  return id
}

function getLatestByTree(treeId, storyType = 'A') {
  return getDb().prepare(`
    SELECT * FROM stories WHERE tree_id = ? AND story_type = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(treeId, storyType)
}

function getLatestByEvent(eventId, storyType = 'C') {
  return getDb().prepare(`
    SELECT * FROM stories WHERE event_id = ? AND story_type = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(eventId, storyType)
}

module.exports = { insert, getLatestByTree, getLatestByEvent }
