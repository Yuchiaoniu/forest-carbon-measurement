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
                trunkDetected:          { type: SchemaType.BOOLEAN },
                trunkWidthFraction:     { type: SchemaType.NUMBER },
                estimatedDistanceM:     { type: SchemaType.NUMBER },
                breastHeightVisible:    { type: SchemaType.BOOLEAN },
                referenceDetected:      { type: SchemaType.BOOLEAN },
                referenceType:          { type: SchemaType.STRING },
                trunkToReferenceRatio:  { type: SchemaType.NUMBER },
                referenceWidthFraction: { type: SchemaType.NUMBER },
                referenceHeightFraction:{ type: SchemaType.NUMBER },
              },
              required: [
                'trunkDetected', 'trunkWidthFraction', 'estimatedDistanceM',
                'breastHeightVisible', 'referenceDetected', 'referenceType',
                'trunkToReferenceRatio', 'referenceWidthFraction', 'referenceHeightFraction',
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

【樹幹偵測】
1. trunkDetected：是否清楚看到樹幹
2. breastHeightVisible：胸高（地面往上約 1.3 公尺）是否在畫面內
3. estimatedDistanceM：相機到樹幹中心的距離（公尺），根據透視感判斷

【樹幹寬度 - 兩種量法都要填】
4. trunkWidthFraction：胸高處樹幹寬度佔畫面寬度的比例（0.0–1.0）
   - 只測樹幹本體（樹皮左緣到右緣），不含背景和光影
   - 一棵中型樹在 2–3 公尺距離通常是 0.10–0.30
   - 若 >0.60 表示相機非常近，請重新評估

5. trunkToReferenceRatio：胸高處樹幹寬度是參照物代表長度的幾倍
   - 只在 referenceDetected=true 時填入有效值；否則填 0
   - 例：樹幹 ~38mm，信用卡長邊 85.6mm → ratio = 38/85.6 = 0.44
   - 例：樹幹 ~210mm，A4 短邊 210mm   → ratio = 210/210 = 1.00
   - 例：樹幹 ~60mm，30cm 尺          → ratio = 60/300 = 0.20

【實體參照物偵測】
6. referenceDetected：畫面中是否有已知尺寸的參照物（貼近或靠著樹幹）
7. referenceType：填入以下其中一個
   - "creditcard"  信用卡 85.6mm×53.98mm，長寬比 1.59
   - "a4"          A4 紙 210mm×297mm，長寬比 0.71（直放）
   - "ruler30"     30 公分直尺
   - "ruler100"    1 公尺直尺
   - ""            未偵測到
8. referenceWidthFraction：參照物寬度（代表長度方向）佔畫面寬度比例
   - 信用卡：長邊（85.6mm）；A4：短邊（210mm）；直尺：長度方向
   - 未偵測到填 0
9. referenceHeightFraction：參照物高度佔畫面高度比例，未偵測到填 0

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

  // 合理性篩選：trunk 不超過畫面 80%（通常是誤判）
  const valid = raw.filter(f =>
    f.trunkDetected &&
    f.pixelWidth > 0 &&
    f.pixelWidth < iw * 0.8 &&
    f.estimatedDistanceM > 0
  )
  if (valid.length === 0) return null

  const sorted = (arr) => [...arr].sort((a, b) => a - b)
  const median = (arr) => { const s = sorted(arr); return s[Math.floor(s.length / 2)] }

  const distances = valid.map(f => f.estimatedDistanceM)
  const distStd = stdDev(distances)
  const distMean = distances.reduce((a, b) => a + b, 0) / distances.length

  // 路徑 A：有 referenceDetected 且 trunkToReferenceRatio > 0 的幀
  const refFrames = valid.filter(f =>
    f.referenceDetected && (f.trunkToReferenceRatio || 0) > 0 && f.referencePixelWidth > 0
  )
  let referenceDetected = false, referenceType = ''
  let trunkToReferenceRatio = 0, referencePixelWidth = 0, referencePixelHeight = 0

  if (refFrames.length > 0) {
    referenceDetected = true
    referenceType = refFrames[0].referenceType
    trunkToReferenceRatio = median(refFrames.map(f => f.trunkToReferenceRatio))
    referencePixelWidth = median(refFrames.map(f => f.referencePixelWidth))
    referencePixelHeight = median(refFrames.map(f => f.referencePixelHeight))
  }

  return {
    pixelWidth: median(valid.map(f => f.pixelWidth)),
    estimatedDistanceM: median(distances),
    validFrames: valid.length,
    distanceStdPct: distMean > 0 ? (distStd / distMean) * 100 : 100,
    referenceDetected,
    referenceType,
    trunkToReferenceRatio,
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
