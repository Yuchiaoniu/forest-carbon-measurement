const { getFormulaByScientificName } = require('../data/formulaDb')

// 薄透鏡公式計算 DBH
// DBH_mm = pixelWidth × sensorWidth_mm × distance_mm / (imageWidth_px × focalLength_mm)
function calcDbh(pixelWidth, sensorWidthMm, distanceM, imageWidthPx, focalLengthMm) {
  const distanceMm = distanceM * 1000
  if (!pixelWidth || !sensorWidthMm || !distanceMm || !imageWidthPx || !focalLengthMm) return null
  const dbhMm = (pixelWidth * sensorWidthMm * distanceMm) / (imageWidthPx * focalLengthMm)
  return Math.round(dbhMm) / 10 // 轉為 cm，保留 1 位小數
}

// H-D 關係式估算樹高
function estimateHeight(dbhCm, formula) {
  return formula.hdA * Math.pow(dbhCm, formula.hdB)
}

// 材積計算
function calcVolume(dbhCm, heightM, formula) {
  return formula.volA * Math.pow(dbhCm, formula.volB) * Math.pow(heightM, formula.volC)
}

// 碳儲量計算
function calcCarbon(volumeM3, formula) {
  return volumeM3 * formula.woodDensity * formula.bef * 0.5
}

// 信心等級
function getConfidence({ frameQuality, distanceStdPct, validFrames, sensorIsDefault }) {
  if (frameQuality === 'good' && distanceStdPct < 20 && validFrames >= 2 && !sensorIsDefault) return 'high'
  if (frameQuality === 'low' || distanceStdPct >= 20 || validFrames < 2) return 'low'
  return 'medium'
}

function calculate({ species, pixelWidth, estimatedDistanceM, distanceStdPct,
  validFrames, metadata, frameQuality }) {

  const formula = getFormulaByScientificName(species)

  // 距離異常保護
  let distance = estimatedDistanceM
  let distanceWarning = false
  if (!distance || distance <= 0 || distance > 50) {
    distance = 3.0
    distanceWarning = true
  }

  const dbhCm = calcDbh(
    pixelWidth, metadata.sensorWidthMm, distance,
    metadata.imageWidth, metadata.focalLengthMm
  )
  if (!dbhCm) return null

  const heightM = estimateHeight(dbhCm, formula)
  const volumeM3 = calcVolume(dbhCm, heightM, formula)
  const carbonKg = calcCarbon(volumeM3, formula)
  const confidence = getConfidence({
    frameQuality, distanceStdPct, validFrames,
    sensorIsDefault: metadata.sensorIsDefault,
  })

  return {
    dbhCm: Math.round(dbhCm * 10) / 10,
    estimatedHeightM: Math.round(heightM * 10) / 10,
    volumeM3: Math.round(volumeM3 * 10000) / 10000,
    carbonKg: Math.round(carbonKg * 10) / 10,
    confidence,
    formulaSource: formula.isDefault ? 'generic' : 'taiwan-forestry',
    distanceWarning,
    distanceUsedM: distance,
  }
}

module.exports = { calculate }
