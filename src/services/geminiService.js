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
                pixelWidth:           { type: SchemaType.NUMBER },
                estimatedDistanceM:   { type: SchemaType.NUMBER },
                breastHeightVisible:  { type: SchemaType.BOOLEAN },
                referenceDetected:    { type: SchemaType.BOOLEAN },
                referenceType:        { type: SchemaType.STRING },
                referencePixelWidth:  { type: SchemaType.NUMBER },
                referencePixelHeight: { type: SchemaType.NUMBER },
              },
              required: [
                'trunkDetected','pixelWidth','estimatedDistanceM','breastHeightVisible',
                'referenceDetected','referenceType','referencePixelWidth','referencePixelHeight',
              ],
            },
          },
        },
        required: ['frames'],
      },
    },
  })

  const { focalLengthMm, sensorWidthMm, imageWidth } = metadata
  const prompt = `你是林業測量 AI。圖片為手機拍攝的樹木影片關鍵幀。
相機參數：焦距=${focalLengthMm}mm，感光元件寬=${sensorWidthMm}mm，影像寬=${imageWidth}px。

對每張圖片回傳以下資訊：

【樹幹測量】
1. trunkDetected：是否看到明確的樹幹
2. pixelWidth：胸高（約地面1.3公尺）處樹幹的橫向像素寬度
3. estimatedDistanceM：估算相機到樹幹的距離（公尺），請保守估算
4. breastHeightVisible：胸高位置是否在畫面內

【實體參照物偵測】
5. referenceDetected：畫面中是否有信用卡或 A4 紙
   - 信用卡：矩形卡片，長寬比約 1.59（85.6mm × 53.98mm），常見於人手持或貼樹幹
   - A4 紙：白色矩形紙張，長寬比約 1.41（210mm × 297mm）
6. referenceType：偵測到的類型，填 "creditcard"、"a4" 或 ""（未偵測到）
7. referencePixelWidth：參照物的橫向像素寬度（信用卡用長邊，A4 用短邊 210mm 那邊），未偵測到填 0
8. referencePixelHeight：參照物的縱向像素高度，未偵測到填 0

注意：參照物若明顯傾斜或被遮蔽，仍回傳 referenceDetected=false。`

  const parts = [{ text: prompt }]
  frameBase64Array.forEach(b64 => {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: b64 } })
  })

  const result = await model.generateContent(parts)
  return JSON.parse(result.response.text())
}

function getMedianResult(frames) {
  const valid = frames.filter(f => f.trunkDetected && f.pixelWidth > 0 && f.estimatedDistanceM > 0)
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
