const { getFormulaByScientificName } = require('../data/formulaDb')

const REFERENCE_SIZES = {
  creditcard:   { width: 85.6,  height: 53.98 },
  businesscard: { width: 90,    height: 54    },
  a4:           { width: 210,   height: 297   },
  a5:           { width: 148,   height: 210   },
  b5notebook:   { width: 182,   height: 257   },
  ruler30:      { width: 300,   height: 30    },
  ruler100:     { width: 1000,  height: 30    },
  banknote100:  { width: 145,   height: 70    },
  banknote500:  { width: 155,   height: 70    },
  banknote1000: { width: 160,   height: 70    },
}

function validateReferenceAspectRatio(referenceType, pixelWidth, pixelHeight, tolerance = 0.15) {
  if (!pixelWidth || !pixelHeight || pixelWidth <= 0 || pixelHeight <= 0) return true
  const ref = REFERENCE_SIZES[referenceType]
  if (!ref) return true
  const expectedRatio = ref.width / ref.height
  const actualRatio = pixelWidth / pixelHeight
  const deviation = Math.abs(actualRatio - expectedRatio) / expectedRatio
  return deviation <= tolerance
}

function calcDbh(pixelWidth, sensorWidthMm, distanceM, imageWidthPx, focalLengthMm) {
  if (!pixelWidth || !sensorWidthMm || !distanceM || !imageWidthPx || !focalLengthMm) return null
  const dbhMm = (pixelWidth * sensorWidthMm * distanceM * 1000) / (imageWidthPx * focalLengthMm)
  return Math.round(dbhMm) / 10
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

function getConfidence({ frameQuality, distanceStdPct, validFrames, sensorIsDefault, referenceUsed, referenceConfidence, directMeasurementUsed, referenceOffTrunkDetected }) {
  if (directMeasurementUsed) return 'high'
  if (referenceUsed) {
    if (referenceConfidence !== undefined && referenceConfidence < 0.7) return 'medium'
    return 'high'
  }
  if (referenceOffTrunkDetected) return 'medium'
  if (frameQuality === 'good' && distanceStdPct < 20 && validFrames >= 2 && !sensorIsDefault) return 'high'
  if (frameQuality === 'low' || distanceStdPct >= 20 || validFrames < 2) return 'low'
  return 'medium'
}

// 把 DBH → height/volume/carbon 包成一個小單元，供三路徑共用
function buildPathResult(dbhCm, formula, extras = {}) {
  if (dbhCm == null || !(dbhCm > 0)) return null
  const heightM  = estimateHeight(dbhCm, formula)
  const volumeM3 = calcVolume(dbhCm, heightM, formula)
  const carbonKg = calcCarbon(volumeM3, formula)
  return {
    dbhCm:            Math.round(dbhCm * 10) / 10,
    estimatedHeightM: Math.round(heightM * 10) / 10,
    volumeM3:         Math.round(volumeM3 * 10000) / 10000,
    carbonKg:         Math.round(carbonKg * 10) / 10,
    computed: true,
    ...extras,
  }
}

// 路徑 0：直接讀數（捲尺 / 直尺接觸量測）
function calcPath0({ directMeasurementCm, measurementType, formula }) {
  if (!(directMeasurementCm > 0)) return null
  let dbhCm
  if (measurementType === 'circumference') {
    dbhCm = Math.round(directMeasurementCm / Math.PI * 10) / 10
  } else {
    dbhCm = Math.round(directMeasurementCm * 10) / 10
  }
  return buildPathResult(dbhCm, formula, { measurementType, sourceCm: directMeasurementCm })
}

// 路徑 A：參照物倍數比較
function calcPathA({ referenceDetected, referenceType, trunkToReferenceRatio,
                     referencePixelWidth, referencePixelHeight,
                     referenceEstimatedWidthMm, formula }) {
  if (!referenceDetected || !referenceType || !(trunkToReferenceRatio > 0)) return null
  const aspectOk = validateReferenceAspectRatio(referenceType, referencePixelWidth, referencePixelHeight)
  if (!aspectOk) return null
  let refWidthMm = 0
  const refSize = REFERENCE_SIZES[referenceType]
  if (refSize) {
    refWidthMm = refSize.width
  } else if (referenceType === 'unknown' && referenceEstimatedWidthMm > 0) {
    refWidthMm = referenceEstimatedWidthMm
  }
  if (!(refWidthMm > 0)) return null
  const dbhCm = Math.round(trunkToReferenceRatio * refWidthMm / 10 * 10) / 10
  return buildPathResult(dbhCm, formula, { referenceType, referenceWidthMm: refWidthMm, ratio: trunkToReferenceRatio })
}

// 路徑 B：薄透鏡公式
function calcPathB({ pixelWidth, estimatedDistanceM, metadata, formula }) {
  let distanceUsedM = estimatedDistanceM
  let distanceWarning = false
  if (!distanceUsedM || distanceUsedM <= 0 || distanceUsedM > 50) {
    distanceUsedM = 3.0
    distanceWarning = true
  }
  if (!(pixelWidth > 0)) return null
  const dbhCm = calcDbh(pixelWidth, metadata.sensorWidthMm, distanceUsedM, metadata.imageWidth, metadata.focalLengthMm)
  if (dbhCm == null) return null
  return buildPathResult(dbhCm, formula, { distanceUsedM, distanceWarning })
}

function calculate({
  species, pixelWidth, estimatedDistanceM, distanceStdPct,
  validFrames, metadata, frameQuality,
  referenceDetected, referenceType, trunkToReferenceRatio,
  referencePixelWidth, referencePixelHeight,
  referenceEstimatedWidthMm, referenceConfidence,
  directMeasurementCm, measurementType,
  referenceOffTrunkDetected,
}) {
  const formula = getFormulaByScientificName(species)

  // 三路徑無條件並算
  const path0 = calcPath0({ directMeasurementCm, measurementType, formula })
  const pathA = calcPathA({
    referenceDetected, referenceType, trunkToReferenceRatio,
    referencePixelWidth, referencePixelHeight, referenceEstimatedWidthMm, formula,
  })
  const pathB = calcPathB({ pixelWidth, estimatedDistanceM, metadata, formula })

  // pickWinner：沿用既有優先級 0 > A > B
  let winner = null
  let winnerResult = null
  if (path0) { winner = 'path0'; winnerResult = path0 }
  else if (pathA) { winner = 'pathA'; winnerResult = pathA }
  else if (pathB) { winner = 'pathB'; winnerResult = pathB }

  if (!winnerResult) return null

  const directMeasurementUsed = winner === 'path0'
  const referenceUsed         = winner === 'pathA'
  const confidence = getConfidence({
    frameQuality, distanceStdPct, validFrames,
    sensorIsDefault: metadata.sensorIsDefault,
    referenceUsed, referenceConfidence, directMeasurementUsed, referenceOffTrunkDetected,
  })

  if (path0) console.log(`[calc] 路徑0 直接讀數 ${directMeasurementCm}cm (${measurementType}) → DBH=${path0.dbhCm}cm`)
  if (pathA) console.log(`[calc] 路徑A (${pathA.referenceType} ${pathA.referenceWidthMm}mm) ratio=${pathA.ratio.toFixed(3)} → DBH=${pathA.dbhCm}cm`)
  if (pathB) console.log(`[calc] 路徑B 薄透鏡 → DBH=${pathB.dbhCm}cm${pathB.distanceWarning ? ' (距離 fallback 3m)' : ''}`)
  console.log(`[calc] winner=${winner} → 對外 DBH=${winnerResult.dbhCm}cm`)

  return {
    // 對外（向後相容）：贏家的值
    dbhCm:            winnerResult.dbhCm,
    estimatedHeightM: winnerResult.estimatedHeightM,
    volumeM3:         winnerResult.volumeM3,
    carbonKg:         winnerResult.carbonKg,
    confidence,
    formulaSource: formula.isDefault ? 'generic' : 'taiwan-forestry',
    distanceWarning: pathB ? !!pathB.distanceWarning : false,
    distanceUsedM: (directMeasurementUsed || referenceUsed) ? null : (pathB ? pathB.distanceUsedM : null),
    directMeasurementUsed,
    referenceUsed,
    referenceType:    referenceUsed ? pathA.referenceType : null,
    referenceWidthMm: referenceUsed ? pathA.referenceWidthMm : null,
    // 向後相容：原本給 ground_truth 用的 routeBDbhCm
    routeBDbhCm:      pathB ? pathB.dbhCm : null,
    // 三路徑並列
    paths: { path0, pathA, pathB },
    winner,
  }
}

module.exports = { calculate, validateReferenceAspectRatio, REFERENCE_SIZES }
