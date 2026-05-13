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
                trunkDetected:              { type: SchemaType.BOOLEAN },
                trunkWidthFraction:         { type: SchemaType.NUMBER },
                estimatedDistanceM:         { type: SchemaType.NUMBER },
                breastHeightVisible:        { type: SchemaType.BOOLEAN },
                referenceDetected:          { type: SchemaType.BOOLEAN },
                referenceType:              { type: SchemaType.STRING },
                trunkToReferenceRatio:      { type: SchemaType.NUMBER },
                referenceWidthFraction:     { type: SchemaType.NUMBER },
                referenceHeightFraction:    { type: SchemaType.NUMBER },
                referenceEstimatedWidthMm:  { type: SchemaType.NUMBER },
                referenceConfidence:        { type: SchemaType.NUMBER },
              },
              required: [
                'trunkDetected', 'trunkWidthFraction', 'estimatedDistanceM',
                'breastHeightVisible', 'referenceDetected', 'referenceType',
                'trunkToReferenceRatio', 'referenceWidthFraction', 'referenceHeightFraction',
                'referenceEstimatedWidthMm', 'referenceConfidence',
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

【實體參照物偵測】
6. referenceDetected：畫面中是否有可判斷尺寸的實體物件（貼近或靠著樹幹）

7. referenceType：依以下優先順序填入最佳選項

   ★ 已知清單（優先辨識，尺寸固定，精度高）：
   - "creditcard"    信用卡／金融卡／悠遊卡   85.6×53.98mm（長寬比 1.59）
   - "businesscard"  台灣標準名片             90×54mm（長寬比 1.67）
   - "a4"            A4 紙                   210×297mm（長寬比 0.71，直放）
   - "a5"            A5 紙                   148×210mm
   - "b5notebook"    B5 筆記本               182×257mm
   - "ruler30"       30cm 直尺               300mm
   - "ruler100"      1m 直尺                 1000mm
   - "banknote100"   台幣100元紙鈔            130×65mm
   - "banknote500"   台幣500元紙鈔            154×67mm
   - "banknote1000"  台幣1000元紙鈔           160×80mm

   ★ 開放辨識（不在清單但你認識且知道尺寸）：
   - "unknown"  填此值，同時在 referenceEstimatedWidthMm 填入你估算的實際代表長度（mm）
               例：iPhone 15 Pro 寬約 71mm、A6 紙 105mm、國際護照 125mm

   - ""         完全無法判斷尺寸 → referenceDetected=false

8. referenceEstimatedWidthMm：
   - 已知清單物件：填 0（系統會自動查表）
   - "unknown" 物件：填入你估算的實際代表長度（mm）
   - 未偵測到：填 0

9. referenceConfidence：對參照物辨識的信心（0.0–1.0）
   - 已知清單且完整可見：0.9–1.0
   - 已知清單但部分遮擋或角度傾斜：0.6–0.8
   - "unknown" 但有把握估算尺寸：0.5–0.7
   - 不確定：填 0.0 並將 referenceDetected=false

10. referenceWidthFraction：參照物代表長度方向佔畫面寬度比例（0.0–1.0），未偵測到填 0
11. referenceHeightFraction：參照物高度佔畫面高度比例，未偵測到填 0

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
    // referenceType 取出現最多次的那個
    const typeCounts = {}
    refFrames.forEach(f => { typeCounts[f.referenceType] = (typeCounts[f.referenceType] || 0) + 1 })
    referenceType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0]

    const sameTypeFrames = refFrames.filter(f => f.referenceType === referenceType)
    trunkToReferenceRatio      = median(sameTypeFrames.map(f => f.trunkToReferenceRatio))
    referencePixelWidth        = median(sameTypeFrames.map(f => f.referencePixelWidth))
    referencePixelHeight       = median(sameTypeFrames.map(f => f.referencePixelHeight))
    referenceConfidence        = median(sameTypeFrames.map(f => f.referenceConfidence || 0))
    // unknown 類型時取非零的估算寬度中位數
    const estWidths = sameTypeFrames.map(f => f.referenceEstimatedWidthMm || 0).filter(v => v > 0)
    referenceEstimatedWidthMm  = estWidths.length > 0 ? median(estWidths) : 0
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
    referenceEstimatedWidthMm,
    referenceConfidence,
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
