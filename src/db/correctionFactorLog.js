const { getDb } = require('./init')
const { randomUUID } = require('crypto')

function insert({ species, factor, sampleCount, stdDev, triggeredBy }) {
  const id = randomUUID()
  getDb().prepare(`
    INSERT INTO correction_factor_log (id, species, factor, sample_count, std_dev, triggered_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, species, factor, sampleCount, stdDev ?? null, triggeredBy ?? null)
  return id
}

function getBySpecies(species) {
  return getDb().prepare(`
    SELECT * FROM correction_factor_log WHERE species = ? ORDER BY created_at ASC
  `).all(species)
}

module.exports = { insert, getBySpecies }
