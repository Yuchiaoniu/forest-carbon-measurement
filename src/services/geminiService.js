const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai')

let genAI
function getClient() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  return genAI
}

// 樹幹分析：回傳像素寬度與估算距離
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
                trunkDetected:      { type: SchemaType.BOOLEAN },
                pixelWidth:         { type: SchemaType.NUMBER },
                estimatedDistanceM: { type: SchemaType.NUMBER },
                breastHeightVisible:{ type: SchemaType.BOOLEAN },
              },
              required: ['trunkDetected','pixelWidth','estimatedDistanceM','breastHeightVisible'],
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

對每張圖片：
1. trunkDetected：是否看到明確的樹幹
2. pixelWidth：胸高（約地面1.3公尺）處樹幹的橫向像素寬度（若看不到胸高則取可見最下方）
3. estimatedDistanceM：根據透視感、景深、場景線索估算相機到樹幹的距離（公尺）
4. breastHeightVisible：胸高位置是否在畫面內

請保守估算，寧可低估距離也不要高估。`

  const parts = [{ text: prompt }]
  frameBase64Array.forEach(b64 => {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: b64 } })
  })

  const result = await model.generateContent(parts)
  return JSON.parse(result.response.text())
}

// 從分析結果取中位數
function getMedianResult(frames) {
  const valid = frames.filter(f => f.trunkDetected && f.pixelWidth > 0 && f.estimatedDistanceM > 0)
  if (valid.length === 0) return null

  const sorted = (arr) => [...arr].sort((a, b) => a - b)
  const median = (arr) => { const s = sorted(arr); return s[Math.floor(s.length / 2)] }

  const widths = valid.map(f => f.pixelWidth)
  const distances = valid.map(f => f.estimatedDistanceM)
  const distStd = stdDev(distances)
  const distMean = distances.reduce((a, b) => a + b, 0) / distances.length

  return {
    pixelWidth: median(widths),
    estimatedDistanceM: median(distances),
    validFrames: valid.length,
    distanceStdPct: distMean > 0 ? (distStd / distMean) * 100 : 100,
  }
}

function stdDev(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / arr.length)
}

// 樹種辨識（Pl@ntNet fallback）
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

// 帶重試的分析（spec: 最多 1 次重試）
async function analyzeTrunkWithRetry(frameBase64Array, metadata) {
  try {
    const raw = await analyzeTrunk(frameBase64Array, metadata)
    return raw
  } catch {
    await new Promise(r => setTimeout(r, 2000))
    return analyzeTrunk(frameBase64Array, metadata)
  }
}

module.exports = { analyzeTrunkWithRetry, getMedianResult, identifySpeciesFallback }
