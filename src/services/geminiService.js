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
                trunkToReferenceRatio:     { type: SchemaType.NUMBER },
                referenceWidthFraction:    { type: SchemaType.NUMBER },
                referenceHeightFraction:   { type: SchemaType.NUMBER },
                referenceEstimatedWidthMm: { type: SchemaType.NUMBER },
                referenceConfidence:       { type: SchemaType.NUMBER },
                directMeasurementCm:       { type: SchemaType.NUMBER },
                measurementType:           { type: SchemaType.STRING },
              },
              required: [
                'trunkDetected', 'trunkWidthFraction', 'estimatedDistanceM',
                'breastHeightVisible', 'referenceDetected', 'referenceType',
                'trunkToReferenceRatio', 'referenceWidthFraction', 'referenceHeightFraction',
                'referenceEstimatedWidthMm', 'referenceConfidence',
                'directMeasurementCm', 'measurementType',
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
【路徑0：直接量測讀數】 ← 最高精度，優先判斷
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
如果畫面中有人用捲尺、皮尺或直尺直接量測樹幹，且能清楚看到數字讀數：

1. directMeasurementCm：讀到的數值（公分）
   - 捲尺 / 皮尺繞樹一圈 → 填周長讀數（cm），measurementType="circumference"
   - 直尺直接橫量樹幹直徑 → 填直徑讀數（cm），measurementType="diameter"
   - 看不到讀數 / 沒有直接量測 → 填 0

2. measurementType：
   - "circumference"  捲尺繞圈，讀到的是周長
   - "diameter"       直尺橫量，讀到的是直徑
   - ""               無直接量測

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【路徑A：參照物倍數比較】 ← 次優先
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. referenceDetected：畫面中是否有可判斷尺寸的實體物件（貼近或靠著樹幹）

4. referenceType：依以下優先順序填入

   ★ 已知清單（優先，尺寸固定）：
   - "creditcard"    信用卡／金融卡／悠遊卡   85.6×53.98mm
   - "businesscard"  台灣標準名片             90×54mm
   - "a4"            A4 紙                   210×297mm
   - "a5"            A5 紙                   148×210mm
   - "b5notebook"    B5 筆記本               182×257mm
   - "ruler30"       30cm 直尺               300mm
   - "ruler100"      1m 直尺                 1000mm
   - "banknote100"   台幣100元紙鈔            130×65mm
   - "banknote500"   台幣500元紙鈔            154×67mm
   - "banknote1000"  台幣1000元紙鈔           160×80mm

   ★ 開放辨識（不在清單但你認識且知道尺寸）：
   - "unknown"  同時在 referenceEstimatedWidthMm 填入估算實際寬度（mm）

   - ""  完全無法判斷 → referenceDetected=false

5. trunkToReferenceRatio：胸高處樹幹寬度是參照物代表長度的幾倍
   - 只在 referenceDetected=true 時填；否則填 0
   - 例：樹幹 ~38mm，信用卡 85.6mm → ratio = 0.44
   - 例：樹幹 ~210mm，A4短邊 210mm  → ratio = 1.00

6. referenceEstimatedWidthMm：已知清單填 0；unknown 類型填估算寬度（mm）
7. referenceConfidence：辨識信心 0.0–1.0（清單且完整可見→0.9–1.0；遮擋→0.6–0.8；unknown→0.5–0.7）
8. referenceWidthFraction：參照物代表長度方向佔畫面寬度比例（0.0–1.0），未偵測填 0
9. referenceHeightFraction：參照物高度佔畫面高度比例，未偵測填 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【路徑B：樹幹測量（備援）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. trunkDetected：是否清楚看到樹幹
11. breastHeightVisible：胸高（距地面約 1.3 公尺）是否在畫面內
12. estimatedDistanceM：相機到樹幹中心的距離（公尺），根據透視感判斷
13. trunkWidthFraction：胸高處樹幹寬度佔畫面寬度比例（0.0–1.0）
    - 只測樹幹本體（左緣到右緣），不含背景和光影
    - 中型樹在 2–3 公尺距離通常是 0.10–0.30
    - 若 >0.60 表示相機非常近，請重新評估

注意：參照物傾斜 45° 以內仍可偵測，傾斜 >45° 才填 referenceDetected=false。`

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

  // ── 路徑 0：直接讀數（從所有幀，包含捲尺特寫）
  const directFrames = raw.filter(f => (f.directMeasurementCm || 0) > 0)
  let directMeasurementCm = 0, measurementType = ''
  if (directFrames.length > 0) {
    directMeasurementCm = median(directFrames.map(f => f.directMeasurementCm))
    measurementType = modeStr(directFrames.map(f => f.measurementType || 'diameter'))
  }

  // ── 有效幀篩選（樹幹清楚可見）
  const valid = raw.filter(f =>
    f.trunkDetected &&
    f.pixelWidth > 0 &&
    f.pixelWidth < iw * 0.8 &&
    f.estimatedDistanceM > 0
  )

  // 有直接讀數時，即使 valid 幀不足也可繼續
  if (valid.length === 0 && directMeasurementCm === 0) return null

  // 有效幀不足時用空值（DBH 會由路徑 0 提供）
  const pixelWidth        = valid.length > 0 ? median(valid.map(f => f.pixelWidth)) : 0
  const estimatedDistanceM = valid.length > 0 ? median(valid.map(f => f.estimatedDistanceM)) : 0
  const distances         = valid.map(f => f.estimatedDistanceM)
  const distMean          = distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 0
  const distStd           = distances.length > 0 ? stdDev(distances) : 0

  // ── 路徑 A：參照物倍數比較
  const refFrames = valid.filter(f =>
    f.referenceDetected &&
    (f.trunkToReferenceRatio || 0) > 0 &&
    f.referencePixelWidth > 0 &&
    (f.referenceConfidence || 0) >= 0.4
  )
  let referenceDetected = false, referenceType = ''
  let trunkToReferenceRatio = 0, referencePixelWidth = 0, referencePixelHeight = 0
  let referenceEstimatedWidthMm = 0, referenceConfidence = 0

  if (refFrames.length > 0) {
    referenceDetected = true
    referenceType = modeStr(refFrames.map(f => f.referenceType))
    const sameType = refFrames.filter(f => f.referenceType === referenceType)
    trunkToReferenceRatio     = median(sameType.map(f => f.trunkToReferenceRatio))
    referencePixelWidth       = median(sameType.map(f => f.referencePixelWidth))
    referencePixelHeight      = median(sameType.map(f => f.referencePixelHeight))
    referenceConfidence       = median(sameType.map(f => f.referenceConfidence || 0))
    const estWidths = sameType.map(f => f.referenceEstimatedWidthMm || 0).filter(v => v > 0)
    referenceEstimatedWidthMm = estWidths.length > 0 ? median(estWidths) : 0
  }

  return {
    pixelWidth,
    estimatedDistanceM,
    validFrames: valid.length,
    distanceStdPct: distMean > 0 ? (distStd / distMean) * 100 : 100,
    referenceDetected,
    referenceType,
    trunkToReferenceRatio,
    referencePixelWidth,
    referencePixelHeight,
    referenceEstimatedWidthMm,
    referenceConfidence,
    directMeasurementCm,
    measurementType,
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
