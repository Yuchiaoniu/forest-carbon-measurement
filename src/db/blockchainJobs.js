const { getDb } = require('./init')
const { randomUUID } = require('crypto')

function create(treeId) {
  const id = randomUUID()
  getDb().prepare(`
    INSERT INTO blockchain_jobs (id, tree_id, tx_status)
    VALUES (?, ?, 'pending')
  `).run(id, treeId)
  return id
}

function getPending() {
  return getDb().prepare(`
    SELECT bj.id as jobId, bj.retry_count,
           t.id as treeId, t.gps, t.species, t.dbh_cm, t.volume_m3, t.carbon_kg,
           t.video_hash, t.raw_result
    FROM blockchain_jobs bj
    JOIN trees t ON bj.tree_id = t.id
    WHERE bj.tx_status = 'pending' AND bj.tx_hash IS NULL
  `).all()
}

function updateStatus(id, txHash, txStatus = 'confirmed') {
  const db = getDb()
  db.prepare(`
    UPDATE blockchain_jobs
    SET tx_hash = ?, tx_status = ?, last_attempted_at = unixepoch()
    WHERE id = ?
  `).run(txHash, txStatus, id)
  db.prepare(`
    UPDATE trees SET tx_hash = ?, tx_status = ?
    WHERE id = (SELECT tree_id FROM blockchain_jobs WHERE id = ?)
  `).run(txHash, txStatus, id)
}

function incrementRetry(id) {
  getDb().prepare(`
    UPDATE blockchain_jobs
    SET retry_count = retry_count + 1, last_attempted_at = unixepoch()
    WHERE id = ?
  `).run(id)
}

function getByTreeId(treeId) {
  return getDb().prepare(`
    SELECT * FROM blockchain_jobs WHERE tree_id = ? ORDER BY created_at DESC
  `).get(treeId)
}

module.exports = { create, getPending, updateStatus, incrementRetry, getByTreeId }
