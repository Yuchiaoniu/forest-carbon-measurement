const { getDb } = require('../db/init')
const { insert: insertLog } = require('../db/correctionFactorLog')

const MIN_SAMPLES   = 5
const RECENT_DAYS   = 30
const RECENT_WEIGHT = 2
const CF_MIN        = 0.8
const CF_MAX        = 1.2
const MAD_THRESHOLD = 3   // 距離中位數超過 3×MAD 的樣本視為離群值

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

  // MAD 離群值過濾
  const values = rows.map(r => r.correction_factor).sort((a, b) => a - b)
  const mid    = Math.floor(values.length / 2)
  const median = values.length % 2 === 1
    ? values[mid]
    : (values[mid - 1] + values[mid]) / 2
  const absDevs = values.map(v => Math.abs(v - median)).sort((a, b) => a - b)
  const mad = absDevs.length % 2 === 1
    ? absDevs[mid]
    : (absDevs[mid - 1] + absDevs[mid]) / 2
  const madBound = MAD_THRESHOLD * (mad || 0.001) // 防止 mad=0 時沒有任何過濾
  const filtered = rows.filter(r => Math.abs(r.correction_factor - median) <= madBound)

  const outlierCount = rows.length - filtered.length
  if (outlierCount > 0) {
    console.log(`[correction] ${species} 離群值過濾：移除 ${outlierCount}/${rows.length} 筆`)
  }

  if (filtered.length < MIN_SAMPLES) {
    return { applicable: false, sampleCount: filtered.length, minSamples: MIN_SAMPLES, outlierCount }
  }

  // 加權平均：近期資料 weight=2，較舊 weight=1
  let weightedSum = 0, totalWeight = 0
  filtered.forEach(r => {
    const w = r.created_at >= cutoff ? RECENT_WEIGHT : 1
    weightedSum += r.correction_factor * w
    totalWeight += w
  })
  const weightedAvg = weightedSum / totalWeight

  // 安全邊界檢查：超出 [0.8, 1.2] 代表模型有根本性偏差，不套用
  if (weightedAvg < CF_MIN || weightedAvg > CF_MAX) {
    console.warn(`[correction] ${species} CF=${weightedAvg.toFixed(4)} 超出安全邊界 [${CF_MIN}, ${CF_MAX}]，停用自動修正`)
    return {
      applicable: false,
      sampleCount: filtered.length,
      correctionFactor: Math.round(weightedAvg * 10000) / 10000,
      outOfBounds: true,
    }
  }

  // 標準差（無加權）
  const mean = filtered.reduce((s, r) => s + r.correction_factor, 0) / filtered.length
  const variance = filtered.reduce((s, r) => s + (r.correction_factor - mean) ** 2, 0) / filtered.length
  const stdDev = Math.sqrt(variance)

  return {
    applicable: true,
    sampleCount: filtered.length,
    outlierCount,
    correctionFactor: Math.round(weightedAvg * 10000) / 10000,
    stdDev: Math.round(stdDev * 10000) / 10000,
    recentCount: filtered.filter(r => r.created_at >= cutoff).length,
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
