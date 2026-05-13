const { getFormulaByScientificName } = require('../data/formulaDb')

// 參照物物理尺寸（mm）
const REFERENCE_SIZES = {
  creditcard: { width: 85.6,  height: 53.98, ratio: 85.6 / 53.98 },  // 1.586
  a4:         { width: 210,   height: 297,   ratio: 210 / 297 },       // 0.707（短邊/長邊）
  ruler30:    { width: 300,   height: 30,    ratio: 300 / 30 },        // 10.0（30cm尺）
  ruler100:   { width: 1000,  height: 30,    ratio: 1000 / 30 },       // 33.3（1m尺）
}

// 薄透鏡公式計算 DBH
function calcDbh(pixelWidth, sensorWidthMm, distanceM, imageWidthPx, focalLengthMm) {
  const distanceMm = distanceM * 1000
  if (!pixelWidth || !sensorWidthMm || !distanceMm || !imageWidthPx || !focalLengthMm) return null
  const dbhMm = (pixelWidth * sensorWidthMm * distanceMm) / (imageWidthPx * focalLengthMm)
  return Math.round(dbhMm) / 10
}

// 比例尺換算 DBH（有實體參照物時使用）
function calculateWithReference(trunkPx, refPx, refMm) {
  if (!trunkPx || !refPx || !refMm) return null
  const scaleMMperPx = refMm / refPx
  const dbhMm = trunkPx * scaleMMperPx
  return { dbhCm: Math.round(dbhMm / 10 * 10) / 10, scaleMMperPx }
}

// 長寬比驗證（防止誤判）
function validateReferenceAspectRatio(type, pixelWidth, pixelHeight) {
  if (!pixelWidth || !pixelHeight || pixelHeight === 0) return false
  const ref = REFERENCE_SIZES[type]
  if (!ref) return false
  // 直尺細長，長寬比誤差大，跳過長寬比驗證，只確認 pixelWidth > pixelHeight
  if (type === 'ruler30' || type === 'ruler100') return pixelWidth > pixelHeight
  const observed = pixelWidth / pixelHeight
  const expected = ref.ratio
  const tolerance = 0.20  // ±20%（放寬，允許輕微傾斜）
  return Math.abs(observed - expected) / expected <= tolerance
}

function estimateHeight(dbhCm, formula) {
  return formula.hdA * Math.pow(dbhCm, formula.hdB)
}

function calcVolume(dbhCm, heightM, formula) {
  return formula.volA * Math.pow(dbhCm, formula.volB) * Math.pow(heightM, formula.volC)
}

function calcCarbon(volumeM3, formula) {
  return volumeM3 * formula.woodDensity * formula.bef * 0.5
}

function getConfidence({ frameQuality, distanceStdPct, validFrames, sensorIsDefault, referenceUsed }) {
  if (referenceUsed) return 'high'  // 有參照物，強制 high
  if (frameQuality === 'good' && distanceStdPct < 20 && validFrames >= 2 && !sensorIsDefault) return 'high'
  if (frameQuality === 'low' || distanceStdPct >= 20 || validFrames < 2) return 'low'
  return 'medium'
}

function calculate({ species, pixelWidth, estimatedDistanceM, distanceStdPct,
  validFrames, metadata, frameQuality,
  referenceDetected, referenceType, referencePixelWidth, referencePixelHeight }) {

  const formula = getFormulaByScientificName(species)

  // 嘗試參照物路徑
  let dbhCm = null
  let referenceUsed = false
  let referenceScaleMmPerPx = null

  if (referenceDetected && referenceType && referencePixelWidth > 0) {
    const valid = validateReferenceAspectRatio(referenceType, referencePixelWidth, referencePixelHeight)
    if (valid) {
      const refMm = REFERENCE_SIZES[referenceType]?.width
      const refResult = calculateWithReference(pixelWidth, referencePixelWidth, refMm)
      if (refResult) {
        dbhCm = refResult.dbhCm
        referenceUsed = true
        referenceScaleMmPerPx = Math.round(refResult.scaleMMperPx * 10000) / 10000
        console.log(`[calc] 參照物模式 (${referenceType}) scale=${referenceScaleMmPerPx}mm/px DBH=${dbhCm}cm`)
      }
    } else {
      console.log(`[calc] 參照物長寬比驗證失敗 (${referenceType})，改用 AI 估距`)
    }
  }

  // 無參照物或驗證失敗：薄透鏡公式
  let distanceWarning = false
  let distanceUsedM = estimatedDistanceM
  if (!referenceUsed) {
    if (!distanceUsedM || distanceUsedM <= 0 || distanceUsedM > 50) {
      distanceUsedM = 3.0
      distanceWarning = true
    }
    dbhCm = calcDbh(pixelWidth, metadata.sensorWidthMm, distanceUsedM, metadata.imageWidth, metadata.focalLengthMm)
    if (!dbhCm) return null
  }

  const heightM = estimateHeight(dbhCm, formula)
  const volumeM3 = calcVolume(dbhCm, heightM, formula)
  const carbonKg = calcCarbon(volumeM3, formula)
  const confidence = getConfidence({ frameQuality, distanceStdPct, validFrames, sensorIsDefault: metadata.sensorIsDefault, referenceUsed })

  return {
    dbhCm: Math.round(dbhCm * 10) / 10,
    estimatedHeightM: Math.round(heightM * 10) / 10,
    volumeM3: Math.round(volumeM3 * 10000) / 10000,
    carbonKg: Math.round(carbonKg * 10) / 10,
    confidence,
    formulaSource: formula.isDefault ? 'generic' : 'taiwan-forestry',
    distanceWarning,
    distanceUsedM: referenceUsed ? null : distanceUsedM,
    referenceUsed,
    referenceType: referenceUsed ? referenceType : null,
    referenceScaleMmPerPx,
  }
}

module.exports = { calculate }
