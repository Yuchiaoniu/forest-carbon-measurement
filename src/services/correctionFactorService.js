const { getDb } = require('../db/init')
const { insert: insertLog } = require('../db/correctionFactorLog')

const MIN_SAMPLES   = 5
const RECENT_DAYS   = 30
const RECENT_WEIGHT = 2
const CF_MIN        = 0.8
const CF_MAX        = 1.2
const MAD_THRESHOLD = 3

// §27.5：CF per-path（'A' 或 'B'）
// 從 trees + ground_truth join 直接算 actual_dbh / pathX_dbh，
// 避免在 ground_truth 重複塞每條 path 的 CF（cleaner schema）
function getFactorBySpecies(species, path = 'B') {
  if (!species) return { applicable: false, sampleCount: 0, path }
  const pathCol = path === 'A' ? 't.pathA_dbh_cm' : 't.pathB_dbh_cm'

  const rows = getDb().prepare(`
    SELECT (gt.actual_dbh_cm / ${pathCol}) AS cf, gt.created_at
    FROM ground_truth gt
    JOIN trees t ON gt.tree_id = t.id
    WHERE t.species = ?
      AND gt.actual_dbh_cm > 0
      AND ${pathCol} > 0
    ORDER BY gt.created_at DESC
  `).all(species)

  if (rows.length < MIN_SAMPLES) {
    return { applicable: false, sampleCount: rows.length, minSamples: MIN_SAMPLES, path }
  }

  const cutoff = Math.floor(Date.now() / 1000) - RECENT_DAYS * 86400

  // MAD 離群值過濾
  const values = rows.map(r => r.cf).sort((a, b) => a - b)
  const mid    = Math.floor(values.length / 2)
  const median = values.length % 2 === 1
    ? values[mid]
    : (values[mid - 1] + values[mid]) / 2
  const absDevs = values.map(v => Math.abs(v - median)).sort((a, b) => a - b)
  const mad = absDevs.length % 2 === 1
    ? absDevs[mid]
    : (absDevs[mid - 1] + absDevs[mid]) / 2
  const madBound = MAD_THRESHOLD * (mad || 0.001)
  const filtered = rows.filter(r => Math.abs(r.cf - median) <= madBound)

  const outlierCount = rows.length - filtered.length
  if (outlierCount > 0) {
    console.log(`[correction] ${species}/Path${path} 離群值過濾：移除 ${outlierCount}/${rows.length} 筆`)
  }

  if (filtered.length < MIN_SAMPLES) {
    return { applicable: false, sampleCount: filtered.length, minSamples: MIN_SAMPLES, outlierCount, path }
  }

  let weightedSum = 0, totalWeight = 0
  filtered.forEach(r => {
    const w = r.created_at >= cutoff ? RECENT_WEIGHT : 1
    weightedSum += r.cf * w
    totalWeight += w
  })
  const weightedAvg = weightedSum / totalWeight

  if (weightedAvg < CF_MIN || weightedAvg > CF_MAX) {
    console.warn(`[correction] ${species}/Path${path} CF=${weightedAvg.toFixed(4)} 超出安全邊界 [${CF_MIN}, ${CF_MAX}]，停用自動修正`)
    return {
      applicable: false,
      sampleCount: filtered.length,
      correctionFactor: Math.round(weightedAvg * 10000) / 10000,
      outOfBounds: true,
      path,
    }
  }

  const mean = filtered.reduce((s, r) => s + r.cf, 0) / filtered.length
  const variance = filtered.reduce((s, r) => s + (r.cf - mean) ** 2, 0) / filtered.length
  const stdDev = Math.sqrt(variance)

  return {
    applicable: true,
    sampleCount: filtered.length,
    outlierCount,
    correctionFactor: Math.round(weightedAvg * 10000) / 10000,
    stdDev: Math.round(stdDev * 10000) / 10000,
    recentCount: filtered.filter(r => r.created_at >= cutoff).length,
    path,
  }
}

function getAllFactors() {
  const species = getDb().prepare(`
    SELECT DISTINCT t.species
    FROM ground_truth gt
    JOIN trees t ON gt.tree_id = t.id
    WHERE t.species IS NOT NULL
  `).all().map(r => r.species)

  // 同時回 Path A 與 Path B 兩條曲線
  const result = []
  for (const s of species) {
    result.push({ species: s, ...getFactorBySpecies(s, 'A') })
    result.push({ species: s, ...getFactorBySpecies(s, 'B') })
  }
  return result.sort((a, b) => b.sampleCount - a.sampleCount)
}

function snapshotFactor(species, triggeredBy, path = 'B') {
  const result = getFactorBySpecies(species, path)
  if (!result.applicable) return null
  insertLog({
    species,
    factor: result.correctionFactor,
    sampleCount: result.sampleCount,
    stdDev: result.stdDev,
    triggeredBy,
    path,
  })
  return result
}

module.exports = { getFactorBySpecies, getAllFactors, snapshotFactor }
