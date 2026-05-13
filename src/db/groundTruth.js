const { getDb } = require('./init')
const { randomUUID } = require('crypto')

function insert({ treeId, actualDbhCm, estimatedDbhCm, source }) {
  const correctionFactor = estimatedDbhCm > 0
    ? Math.round((actualDbhCm / estimatedDbhCm) * 10000) / 10000
    : null
  const id = randomUUID()
  getDb().prepare(`
    INSERT INTO ground_truth (id, tree_id, actual_dbh_cm, estimated_dbh_cm, correction_factor, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, treeId, actualDbhCm, estimatedDbhCm, correctionFactor, source)
  return { id, correctionFactor }
}

function getByTreeId(treeId) {
  return getDb().prepare('SELECT * FROM ground_truth WHERE tree_id = ? ORDER BY created_at DESC').all(treeId)
}

function getStats() {
  return getDb().prepare(`
    SELECT source, COUNT(*) as count,
           AVG(correction_factor) as avg_correction,
           MIN(correction_factor) as min_correction,
           MAX(correction_factor) as max_correction
    FROM ground_truth
    WHERE correction_factor IS NOT NULL
    GROUP BY source
  `).all()
}

module.exports = { insert, getByTreeId, getStats }
