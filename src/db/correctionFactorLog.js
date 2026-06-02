const { getDb } = require('./init')
const { randomUUID } = require('crypto')

function insert({ species, factor, sampleCount, stdDev, triggeredBy, path }) {
  const id = randomUUID()
  getDb().prepare(`
    INSERT INTO correction_factor_log (id, species, factor, sample_count, std_dev, triggered_by, path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, species, factor, sampleCount, stdDev ?? null, triggeredBy ?? null, path ?? 'B')
  return id
}

function getBySpecies(species, path = null) {
  if (path) {
    return getDb().prepare(`
      SELECT * FROM correction_factor_log WHERE species = ? AND path = ? ORDER BY created_at ASC
    `).all(species, path)
  }
  return getDb().prepare(`
    SELECT * FROM correction_factor_log WHERE species = ? ORDER BY created_at ASC
  `).all(species)
}

module.exports = { insert, getBySpecies }
