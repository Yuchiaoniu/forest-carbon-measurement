const { getFormulaByScientificName } = require('../data/formulaDb')

// 參照物物理尺寸（mm）- 代表長度方向
const REFERENCE_SIZES = {
  creditcard: { width: 85.6,  height: 53.98 },
  a4:         { width: 210,   height: 297   },
  ruler30:    { width: 300,   height: 30    },
  ruler100:   { width: 1000,  height: 30    },
}

// 薄透鏡公式計算 DBH（公分）
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

function getConfidence({ frameQuality, distanceStdPct, validFrames, sensorIsDefault, referenceUsed }) {
  if (referenceUsed) return 'high'
  if (frameQuality === 'good' && distanceStdPct < 20 && validFrames >= 2 && !sensorIsDefault) return 'high'
  if (frameQuality === 'low' || distanceStdPct >= 20 || validFrames < 2) return 'low'
  return 'medium'
}

function calculate({
  species, pixelWidth, estimatedDistanceM, distanceStdPct,
  validFrames, metadata, frameQuality,
  referenceDetected, referenceType, trunkToReferenceRatio,
  referencePixelWidth, referencePixelHeight,
}) {
  const formula = getFormulaByScientificName(species)

  let dbhCm = null
  let referenceUsed = false

  // 路徑 A：倍數比較（優先）
  if (referenceDetected && referenceType && trunkToReferenceRatio > 0) {
    const refSize = REFERENCE_SIZES[referenceType]
    if (refSize) {
      dbhCm = Math.round(trunkToReferenceRatio * refSize.width / 10 * 10) / 10
      referenceUsed = true
      console.log(`[calc] 路徑A (${referenceType}) ratio=${trunkToReferenceRatio.toFixed(3)} → DBH=${dbhCm}cm`)
    }
  }

  // 路徑 B：薄透鏡公式（備援）
  let distanceWarning = false
  let distanceUsedM = estimatedDistanceM
  let routeBDbhCm = null  // 路徑B的估算值，供修正因子學習使用

  if (!referenceUsed) {
    if (!distanceUsedM || distanceUsedM <= 0 || distanceUsedM > 50) {
      distanceUsedM = 3.0
      distanceWarning = true
    }
    dbhCm = calcDbh(pixelWidth, metadata.sensorWidthMm, distanceUsedM, metadata.imageWidth, metadata.focalLengthMm)
    if (!dbhCm) return null
  } else {
    // 路徑A成功時，同時計算路徑B（用於修正因子學習）
    if (distanceUsedM > 0 && distanceUsedM <= 50 && pixelWidth > 0) {
      routeBDbhCm = calcDbh(pixelWidth, metadata.sensorWidthMm, distanceUsedM, metadata.imageWidth, metadata.focalLengthMm)
    }
    if (!routeBDbhCm) {
      // 距離估算不可用時，用路徑A值本身（修正因子=1，不影響系統但也不學習）
      routeBDbhCm = dbhCm
    }
  }

  const heightM = estimateHeight(dbhCm, formula)
  const volumeM3 = calcVolume(dbhCm, heightM, formula)
  const carbonKg = calcCarbon(volumeM3, formula)
  const confidence = getConfidence({
    frameQuality, distanceStdPct, validFrames,
    sensorIsDefault: metadata.sensorIsDefault, referenceUsed,
  })

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
    routeBDbhCm,  // 路徑B的平行估算，供支柱二學習
  }
}

module.exports = { calculate }
