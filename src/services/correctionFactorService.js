const { getDb } = require('../db/init')
const { insert: insertLog } = require('../db/correctionFactorLog')

const MIN_SAMPLES = 5
const RECENT_DAYS = 30
const RECENT_WEIGHT = 2

function getFactorBySpecies(species) {
  if (!species) return { applicable: false, sampleCount: 0 }

  const cutoff = Math.floor(Date.now() / 1000) - RECENT_DAYS * 86400
  const rows = getDb().prepare(`
    SELECT correction_factor, created_at
    FROM ground_truth
    WHERE tree_id IN (SELECT id FROM trees WHERE species = ?)
      AND correction_factor IS NOT NULL
    ORDER BY created_at DESC
  `).all(species)

  if (rows.length < MIN_SAMPLES) {
    return { applicable: false, sampleCount: rows.length, minSamples: MIN_SAMPLES }
  }

  // 加權平均：近期資料 weight=2，較舊 weight=1
  let weightedSum = 0, totalWeight = 0
  rows.forEach(r => {
    const w = r.created_at >= cutoff ? RECENT_WEIGHT : 1
    weightedSum += r.correction_factor * w
    totalWeight += w
  })
  const weightedAvg = weightedSum / totalWeight

  // 標準差（無加權）
  const mean = rows.reduce((s, r) => s + r.correction_factor, 0) / rows.length
  const variance = rows.reduce((s, r) => s + (r.correction_factor - mean) ** 2, 0) / rows.length
  const stdDev = Math.sqrt(variance)

  return {
    applicable: true,
    sampleCount: rows.length,
    correctionFactor: Math.round(weightedAvg * 10000) / 10000,
    stdDev: Math.round(stdDev * 10000) / 10000,
    recentCount: rows.filter(r => r.created_at >= cutoff).length,
  }
}

function getAllFactors() {
  const species = getDb().prepare(`
    SELECT DISTINCT t.species
    FROM ground_truth gt
    JOIN trees t ON gt.tree_id = t.id
    WHERE gt.correction_factor IS NOT NULL AND t.species IS NOT NULL
  `).all().map(r => r.species)

  return species.map(s => ({ species: s, ...getFactorBySpecies(s) }))
    .sort((a, b) => b.sampleCount - a.sampleCount)
}

function snapshotFactor(species, triggeredBy) {
  const result = getFactorBySpecies(species)
  if (!result.applicable) return null
  insertLog({
    species,
    factor: result.correctionFactor,
    sampleCount: result.sampleCount,
    stdDev: result.stdDev,
    triggeredBy,
  })
  return result
}

module.exports = { getFactorBySpecies, getAllFactors, snapshotFactor }
