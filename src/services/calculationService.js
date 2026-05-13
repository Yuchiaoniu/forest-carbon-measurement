const { getFormulaByScientificName } = require('../data/formulaDb')

// 已知實體參照物的代表長度（mm）- 取長邊或長度方向
const REFERENCE_SIZES = {
  creditcard:   { width: 85.6,  height: 53.98 },
  businesscard: { width: 90,    height: 54    },
  a4:           { width: 210,   height: 297   },
  a5:           { width: 148,   height: 210   },
  b5notebook:   { width: 182,   height: 257   },
  ruler30:      { width: 300,   height: 30    },
  ruler100:     { width: 1000,  height: 30    },
  banknote100:  { width: 130,   height: 65    },
  banknote500:  { width: 154,   height: 67    },
  banknote1000: { width: 160,   height: 80    },
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

function getConfidence({ frameQuality, distanceStdPct, validFrames, sensorIsDefault, referenceUsed, referenceConfidence }) {
  if (referenceUsed) {
    // 開放辨識（unknown）且信心不足時降為 medium
    if (referenceConfidence !== undefined && referenceConfidence < 0.7) return 'medium'
    return 'high'
  }
  if (frameQuality === 'good' && distanceStdPct < 20 && validFrames >= 2 && !sensorIsDefault) return 'high'
  if (frameQuality === 'low' || distanceStdPct >= 20 || validFrames < 2) return 'low'
  return 'medium'
}

function calculate({
  species, pixelWidth, estimatedDistanceM, distanceStdPct,
  validFrames, metadata, frameQuality,
  referenceDetected, referenceType, trunkToReferenceRatio,
  referencePixelWidth, referencePixelHeight,
  referenceEstimatedWidthMm, referenceConfidence,
}) {
  const formula = getFormulaByScientificName(species)

  let dbhCm = null
  let referenceUsed = false
  let refWidthMm = 0

  // 路徑 A：倍數比較（優先）
  if (referenceDetected && referenceType && trunkToReferenceRatio > 0) {
    const refSize = REFERENCE_SIZES[referenceType]
    if (refSize) {
      // 已知清單：直接查表
      refWidthMm = refSize.width
    } else if (referenceType === 'unknown' && referenceEstimatedWidthMm > 0) {
      // 開放辨識：使用 Gemini 估算的寬度
      refWidthMm = referenceEstimatedWidthMm
    }

    if (refWidthMm > 0) {
      dbhCm = Math.round(trunkToReferenceRatio * refWidthMm / 10 * 10) / 10
      referenceUsed = true
      console.log(`[calc] 路徑A (${referenceType}${refWidthMm}mm) ratio=${trunkToReferenceRatio.toFixed(3)} → DBH=${dbhCm}cm`)
    }
  }

  // 路徑 B：薄透鏡公式（備援）
  let distanceWarning = false
  let distanceUsedM = estimatedDistanceM
  let routeBDbhCm = null

  if (!referenceUsed) {
    if (!distanceUsedM || distanceUsedM <= 0 || distanceUsedM > 50) {
      distanceUsedM = 3.0
      distanceWarning = true
    }
    dbhCm = calcDbh(pixelWidth, metadata.sensorWidthMm, distanceUsedM, metadata.imageWidth, metadata.focalLengthMm)
    if (!dbhCm) return null
  } else {
    // 路徑 A 成功時，同時計算路徑 B（供支柱二學習修正因子）
    if (distanceUsedM > 0 && distanceUsedM <= 50 && pixelWidth > 0) {
      routeBDbhCm = calcDbh(pixelWidth, metadata.sensorWidthMm, distanceUsedM, metadata.imageWidth, metadata.focalLengthMm)
    }
    if (!routeBDbhCm) routeBDbhCm = dbhCm
  }

  const heightM = estimateHeight(dbhCm, formula)
  const volumeM3 = calcVolume(dbhCm, heightM, formula)
  const carbonKg = calcCarbon(volumeM3, formula)
  const confidence = getConfidence({
    frameQuality, distanceStdPct, validFrames,
    sensorIsDefault: metadata.sensorIsDefault,
    referenceUsed,
    referenceConfidence,
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
    referenceWidthMm: referenceUsed ? refWidthMm : null,
    routeBDbhCm,
  }
}

module.exports = { calculate }
