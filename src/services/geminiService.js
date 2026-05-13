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
                trunkDetected:        { type: SchemaType.BOOLEAN },
                trunkWidthFraction:   { type: SchemaType.NUMBER },
                estimatedDistanceM:   { type: SchemaType.NUMBER },
                breastHeightVisible:  { type: SchemaType.BOOLEAN },
                referenceDetected:    { type: SchemaType.BOOLEAN },
                referenceType:        { type: SchemaType.STRING },
                referenceWidthFraction:  { type: SchemaType.NUMBER },
                referenceHeightFraction: { type: SchemaType.NUMBER },
              },
              required: [
                'trunkDetected','trunkWidthFraction','estimatedDistanceM','breastHeightVisible',
                'referenceDetected','referenceType','referenceWidthFraction','referenceHeightFraction',
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

對每張圖片回傳以下資訊（寬度/高度均以「佔畫面比例」表示，範圍 0.0–1.0）：

【樹幹測量】
1. trunkDetected：是否清楚看到樹幹
2. trunkWidthFraction：胸高（地面往上約 1/3 畫面高度處）樹幹寬度佔畫面寬度的比例
   - 只測量樹幹本體（樹皮左緣到右緣），不含背景、光影
   - 一棵中型樹在 2–3 公尺距離通常佔 0.10–0.25；若 >0.60 表示非常近
   - 範例：樹幹 288px / 1920px = 0.15
3. estimatedDistanceM：相機到樹幹中心的距離（公尺）
4. breastHeightVisible：胸高（1.3公尺高度）是否在畫面內

【實體參照物偵測】
5. referenceDetected：畫面中是否有已知尺寸的參照物（信用卡、A4 紙、直尺）
   - 信用卡：85.6mm × 53.98mm，長寬比約 1.59
   - A4 紙：210mm × 297mm，長寬比約 0.71（直擺）
   - 直尺（ruler）：長 30cm 或 100cm 的細長矩形，常見刻度線
   - 參照物須貼近或緊靠樹幹，且正面朝向鏡頭（傾斜 <45° 仍可偵測）
6. referenceType：填 "creditcard"、"a4"、"ruler30"（30cm尺）、"ruler100"（1m尺）或 ""
7. referenceWidthFraction：參照物寬度佔畫面寬度比例
   - 信用卡：長邊（85.6mm）；A4：短邊（210mm）；直尺：長度方向
8. referenceHeightFraction：參照物高度佔畫面高度比例`

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

  // 支援新格式（fraction）和舊格式（pixelWidth）
  const normalize = (f) => ({
    ...f,
    pixelWidth: f.trunkWidthFraction != null
      ? Math.round(f.trunkWidthFraction * iw)
      : (f.pixelWidth || 0),
    referencePixelWidth: f.referenceWidthFraction != null
      ? Math.round(f.referenceWidthFraction * iw)
      : (f.referencePixelWidth || 0),
    referencePixelHeight: f.referenceHeightFraction != null
      ? Math.round(f.referenceHeightFraction * ih)
      : (f.referencePixelHeight || 0),
  })

  const raw = frames.map(normalize)
  // 合理性篩選：trunk 不應超過畫面寬 80%（trunkWidthFraction > 0.8 代表相機貼很近，通常是誤判）
  const valid = raw.filter(f =>
    f.trunkDetected &&
    f.pixelWidth > 0 &&
    f.pixelWidth < iw * 0.8 &&
    f.estimatedDistanceM > 0
  )
  if (valid.length === 0) return null

  const sorted = (arr) => [...arr].sort((a, b) => a - b)
  const median = (arr) => { const s = sorted(arr); return s[Math.floor(s.length / 2)] }

  const widths = valid.map(f => f.pixelWidth)
  const distances = valid.map(f => f.estimatedDistanceM)
  const distStd = stdDev(distances)
  const distMean = distances.reduce((a, b) => a + b, 0) / distances.length

  // 參照物：優先取有偵測到的幀
  const refFrames = valid.filter(f => f.referenceDetected && f.referencePixelWidth > 0)
  let referenceDetected = false, referenceType = '', referencePixelWidth = 0, referencePixelHeight = 0
  if (refFrames.length > 0) {
    referenceDetected = true
    referenceType = refFrames[0].referenceType
    referencePixelWidth = median(refFrames.map(f => f.referencePixelWidth))
    referencePixelHeight = median(refFrames.map(f => f.referencePixelHeight))
  }

  return {
    pixelWidth: median(widths),
    estimatedDistanceM: median(distances),
    validFrames: valid.length,
    distanceStdPct: distMean > 0 ? (distStd / distMean) * 100 : 100,
    referenceDetected,
    referenceType,
    referencePixelWidth,
    referencePixelHeight,
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
        required: ['scientificName','zhName','confidence'],
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
