const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai')

let genAI
function getClient() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  return genAI
}

async function analyzeTrunk(frameBase64Array, metadata) {
  const model = getClient().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          frames: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                trunkDetected:             { type: SchemaType.BOOLEAN },
                trunkWidthFraction:        { type: SchemaType.NUMBER },
                estimatedDistanceM:        { type: SchemaType.NUMBER },
                breastHeightVisible:       { type: SchemaType.BOOLEAN },
                referenceDetected:         { type: SchemaType.BOOLEAN },
                referenceType:             { type: SchemaType.STRING },
                referenceAtTrunk:          { type: SchemaType.BOOLEAN },
                trunkToReferenceRatio:     { type: SchemaType.NUMBER },
                referenceWidthFraction:    { type: SchemaType.NUMBER },
                referenceHeightFraction:   { type: SchemaType.NUMBER },
                referenceEstimatedWidthMm: { type: SchemaType.NUMBER },
                referenceConfidence:       { type: SchemaType.NUMBER },
                directMeasurementCm:         { type: SchemaType.NUMBER },
                measurementType:             { type: SchemaType.STRING },
                directMeasurementConfidence: { type: SchemaType.NUMBER },
                leafVisible:                 { type: SchemaType.BOOLEAN },
              },
              required: [
                'trunkDetected', 'trunkWidthFraction', 'estimatedDistanceM',
                'breastHeightVisible', 'referenceDetected', 'referenceType',
                'referenceAtTrunk', 'trunkToReferenceRatio',
                'referenceWidthFraction', 'referenceHeightFraction',
                'referenceEstimatedWidthMm', 'referenceConfidence',
                'directMeasurementCm', 'measurementType', 'directMeasurementConfidence',
                'leafVisible',
              ],
            },
          },
        },
        required: ['frames'],
      },
    },
  })

  const { focalLengthMm, sensorWidthMm, imageWidth, imageHeight } = metadata
  const prompt = `你是林業測量 AI。圖片為手機拍攝的樹木影片關鍵幀。
影像尺寸：${imageWidth}×${imageHeight}px，焦距=${focalLengthMm}mm，感光元件寬=${sensorWidthMm}mm。

對每張圖片回傳以下資訊：

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【路徑0：直接量測讀數】← 最高精度，優先判斷
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
如果畫面中有人用捲尺、皮尺或直尺直接量測樹幹，且能清楚看到數字讀數：

1. directMeasurementCm：讀到的數值（公分），看不到或無直接量測填 0
2. measurementType：
   - "circumference"  捲尺繞圈，讀到的是周長
   - "diameter"       直尺橫量，讀到的是直徑
   - ""               無直接量測
2a. directMeasurementConfidence：讀數信心度 0.0–1.0，依下列因素評估：
    - 數字清晰可辨、字體完整                                +0.3~0.5
    - 皮尺平直未彎曲、刻度線清楚                            +0.2
    - 視角正對讀數位置（無斜角壓縮）                        +0.2
    - 量測位置明確在 1.3m 胸高處                            +0.1
    - 無遮擋（手指、樹皮陰影未蓋住讀數）                    +0.1
    無直接量測時填 0；模糊不清難辨填 0.1~0.3；清楚可信填 0.8~1.0。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【路徑A：參照物比例換算】← 次優先
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. referenceDetected：畫面中是否有可判斷尺寸的實體物件

4. referenceAtTrunk：參照物是否靠著樹幹或在樹幹正下方？
   - true  = 參照物接觸樹幹、貼在樹幹上、或放在樹幹根部正下方（水平距離相同）
   - false = 參照物在遠景、背景、相機附近或與樹幹有明顯水平距離

5. referenceType（已知清單優先，開放辨識備援）：
   - "creditcard"    信用卡／金融卡   85.6×53.98mm
   - "businesscard"  台灣標準名片     90×54mm
   - "a4"            A4 紙           210×297mm
   - "a5"            A5 紙           148×210mm
   - "b5notebook"    B5 筆記本       182×257mm
   - "ruler30"       30cm 直尺       300mm
   - "ruler100"      1m 直尺         1000mm
   - "banknote100"   台幣100元        145×70mm
   - "banknote500"   台幣500元        155×70mm
   - "banknote1000"  台幣1000元       160×70mm
   - "unknown"       不在清單但你認識且知道尺寸，填 referenceEstimatedWidthMm
   - ""              無法判斷 → referenceDetected=false

6. trunkToReferenceRatio：胸高樹幹寬是參照物代表長度的幾倍，無則填 0
7. referenceEstimatedWidthMm：已知清單填 0；unknown 填估算寬度（mm）
8. referenceConfidence：辨識信心 0.0–1.0
9. referenceWidthFraction：參照物代表長度佔畫面寬比例，無則填 0
10. referenceHeightFraction：參照物高度佔畫面高比例，無則填 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【路徑B：樹幹視覺測量】← 備援
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. trunkDetected：是否清楚看到樹幹
12. breastHeightVisible：胸高（距地面約 1.3m）是否在畫面內
13. estimatedDistanceM：相機到樹幹中心距離（公尺）
14. trunkWidthFraction：胸高處樹幹寬佔畫面寬比例（0.0–1.0）
    中型樹在 2–3m 通常 0.10–0.30；若 >0.60 請重新評估

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【樹種辨識輔助】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. leafVisible：畫面中是否有清晰可辨識樹種的葉片、花、果實或明顯樹冠
    - true  = 葉片細節清楚，適合植物辨識 API 使用
    - false = 只有樹幹、土壤或模糊背景

注意：參照物傾斜 45° 以內仍可偵測；referenceAtTrunk 只看水平距離，不看高度。`

  const parts = [{ text: prompt }]
  frameBase64Array.forEach(b64 => {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: b64 } })
  })

  const result = await model.generateContent(parts)
  return JSON.parse(result.response.text())
}

function getMedianResult(frames, imageWidth, imageHeight) {
  const iw = imageWidth || 1920
  const ih = imageHeight || 1080

  const normalize = (f) => ({
    ...f,
    pixelWidth: Math.round((f.trunkWidthFraction || 0) * iw),
    referencePixelWidth: Math.round((f.referenceWidthFraction || 0) * iw),
    referencePixelHeight: Math.round((f.referenceHeightFraction || 0) * ih),
  })

  const raw = frames.map(normalize)

  const sortedArr = (arr) => [...arr].sort((a, b) => a - b)
  const median = (arr) => { const s = sortedArr(arr); return s[Math.floor(s.length / 2)] }
  const modeStr = (arr) => Object.entries(
    arr.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc }, {})
  ).sort((a, b) => b[1] - a[1])[0][0]

  // ── 路徑 0：直接讀數（從所有幀，含特寫）
  // 1) 過濾信心度 < 0.5 的低品質讀數
  // 2) 群聚：差距 < 10% 視為同一次量測，取最大群中位數，避免跨次量測平均
  const directFrames = raw.filter(f =>
    (f.directMeasurementCm || 0) > 0 &&
    (f.directMeasurementConfidence || 0) >= 0.5
  )
  let directMeasurementCm = 0, measurementType = '', directCluster = null
  let directMeasurementConfidence = 0
  if (directFrames.length > 0) {
    directCluster = clusterByRelativeDiff(
      directFrames.map(f => f.directMeasurementCm), 0.10
    )
    const winningIdx = directCluster.winningIndices
    const winnerVals = winningIdx.map(i => directFrames[i].directMeasurementCm)
    const winnerTypes = winningIdx.map(i => directFrames[i].measurementType || 'diameter')
    const winnerConfs = winningIdx.map(i => directFrames[i].directMeasurementConfidence || 0)

    // 最大群只有 1 幀，且其餘幀差距 > 10%（即非孤立讀數）→ 退回路徑 A/B
    if (winnerVals.length === 1 && directFrames.length > 1) {
      directMeasurementCm = 0
      measurementType = ''
    } else {
      directMeasurementCm = median(winnerVals)
      measurementType = modeStr(winnerTypes)
      directMeasurementConfidence = median(winnerConfs)
    }
  }

  // breastHeightVisible：1.3m 標記是否在任一幀被 Gemini 認出（用於後續可追溯）
  const breastHeightFrames = raw.filter(f => f.breastHeightVisible === true).length
  const breastHeightVisible = breastHeightFrames > 0
  const breastHeightVisibleRatio = raw.length > 0 ? breastHeightFrames / raw.length : 0

  // ── 有效幀篩選（樹幹清楚可見）
  const valid = raw.filter(f =>
    f.trunkDetected &&
    f.pixelWidth > 0 &&
    f.pixelWidth < iw * 0.8 &&
    f.estimatedDistanceM > 0
  )

  if (valid.length === 0 && directMeasurementCm === 0) return null

  const pixelWidth         = valid.length > 0 ? median(valid.map(f => f.pixelWidth)) : 0
  const estimatedDistanceM = valid.length > 0 ? median(valid.map(f => f.estimatedDistanceM)) : 0
  const distances          = valid.map(f => f.estimatedDistanceM)
  const distMean           = distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 0
  const distStd            = distances.length > 0 ? stdDev(distances) : 0

  // ── 路徑 A：參照物（僅限 referenceAtTrunk=true 的幀）
  const refFrames = valid.filter(f =>
    f.referenceDetected &&
    f.referenceAtTrunk !== false &&          // 必須靠著樹幹
    (f.trunkToReferenceRatio || 0) > 0 &&
    f.referencePixelWidth > 0 &&
    (f.referenceConfidence || 0) >= 0.4
  )
  // 也收集「偵測到但不在樹幹旁」的幀，用於產生警告
  const refOffTrunkFrames = valid.filter(f =>
    f.referenceDetected && f.referenceAtTrunk === false
  )

  let referenceDetected = false, referenceType = '', referenceAtTrunk = false
  let trunkToReferenceRatio = 0, referencePixelWidth = 0, referencePixelHeight = 0
  let referenceEstimatedWidthMm = 0, referenceConfidence = 0

  if (refFrames.length > 0) {
    referenceDetected = true
    referenceAtTrunk  = true
    referenceType     = modeStr(refFrames.map(f => f.referenceType))
    const sameType    = refFrames.filter(f => f.referenceType === referenceType)
    trunkToReferenceRatio     = median(sameType.map(f => f.trunkToReferenceRatio))
    referencePixelWidth       = median(sameType.map(f => f.referencePixelWidth))
    referencePixelHeight      = median(sameType.map(f => f.referencePixelHeight))
    referenceConfidence       = median(sameType.map(f => f.referenceConfidence || 0))
    const estWidths = sameType.map(f => f.referenceEstimatedWidthMm || 0).filter(v => v > 0)
    referenceEstimatedWidthMm = estWidths.length > 0 ? median(estWidths) : 0
  }

  // ── 葉片幀索引（供 PlantNet / iNaturalist 使用）
  const leafFrameIndices = raw
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.leafVisible)
    .map(({ i }) => i)

  return {
    pixelWidth,
    estimatedDistanceM,
    validFrames: valid.length,
    distanceStdPct: distMean > 0 ? (distStd / distMean) * 100 : 100,
    referenceDetected,
    referenceAtTrunk,
    referenceType,
    trunkToReferenceRatio,
    referencePixelWidth,
    referencePixelHeight,
    referenceEstimatedWidthMm,
    referenceConfidence,
    referenceOffTrunkDetected: refOffTrunkFrames.length > 0,
    directMeasurementCm,
    directMeasurementConfidence,
    measurementType,
    directCluster,
    breastHeightVisible,
    breastHeightVisibleRatio,
    breastHeightVisibleFrames: breastHeightFrames,
    leafFrameIndices,
  }
}

// 對數值陣列做相對差距群聚（greedy）：將彼此差距 < threshold 的值視為同群。
// 回傳最大群的 indices；用於避免「跨次量測中位數混合」問題。
function clusterByRelativeDiff(values, threshold) {
  if (values.length === 0) return { clusters: [], winningIndices: [] }
  const idx = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const clusters = []
  let current = [idx[0]]
  for (let k = 1; k < idx.length; k++) {
    const ref = current[current.length - 1].v
    const cur = idx[k].v
    if (ref > 0 && Math.abs(cur - ref) / ref <= threshold) {
      current.push(idx[k])
    } else {
      clusters.push(current); current = [idx[k]]
    }
  }
  clusters.push(current)
  const winner = clusters.reduce((a, b) => (b.length > a.length ? b : a))
  return {
    clusterSizes: clusters.map(c => c.length),
    winningIndices: winner.map(x => x.i),
  }
}

function stdDev(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / arr.length)
}

async function identifySpeciesFallback(frameBase64Array, gps) {
  const model = getClient().getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          scientificName: { type: SchemaType.STRING },
          zhName:         { type: SchemaType.STRING },
          confidence:     { type: SchemaType.NUMBER },
          reasoning:      { type: SchemaType.STRING },
        },
        required: ['scientificName', 'zhName', 'confidence'],
      },
    },
  })

  const prompt = `根據圖片辨識台灣常見造林樹種。GPS位置：${gps || '台灣'}。
常見樹種：樟樹(Cinnamomum camphora)、柳杉(Cryptomeria japonica)、
台灣杉(Taiwania cryptomerioides)、相思樹(Acacia confusa)、
楓香(Liquidambar formosana)、光臘樹(Fraxinus griffithii)、木麻黃(Casuarina equisetifolia)。
confidence 0-1，若無法判斷回傳 0.3 以下。`

  const parts = [{ text: prompt }]
  frameBase64Array.slice(0, 2).forEach(b64 => {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: b64 } })
  })

  const result = await model.generateContent(parts)
  return JSON.parse(result.response.text())
}

async function analyzeTrunkWithRetry(frameBase64Array, metadata) {
  try {
    return await analyzeTrunk(frameBase64Array, metadata)
  } catch {
    await new Promise(r => setTimeout(r, 2000))
    return analyzeTrunk(frameBase64Array, metadata)
  }
}

module.exports = { analyzeTrunkWithRetry, getMedianResult, identifySpeciesFallback }
