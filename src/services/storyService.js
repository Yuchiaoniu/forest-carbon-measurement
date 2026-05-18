const { GoogleGenerativeAI } = require('@google/generative-ai')
const { getEcologyBySpecies, getBiodiversityMarkdown } = require('../data/ecologyDb')
const { getWeatherAt, formatWeatherLine } = require('./weatherService')
const { getDb } = require('../db/init')

let _client = null
function getClient() {
  if (!_client) _client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  return _client
}

// 從 GPS 字串解析座標
function parseGps(gpsStr) {
  if (!gpsStr) return null
  const parts = gpsStr.split(',').map(s => parseFloat(s.trim()))
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null
  return { lat: parts[0], lng: parts[1] }
}

// 粗略台灣地理區域描述
function guessRegion(lat, lng) {
  if (!lat || !lng) return '台灣山林'
  if (lat > 25.0) return '台灣北部山林'
  if (lat > 24.5) return '台灣中北部丘陵'
  if (lat > 23.5) return '台灣中部山地'
  if (lat > 23.0) return '台灣南部低海拔'
  return '台灣南端山野'
}

// 碳儲量的語意轉換
function carbonToMeaning(carbonKg) {
  if (carbonKg >= 500) return `相當於一輛汽車行駛約 ${Math.round(carbonKg / 0.21)} 公里所排放的碳`
  if (carbonKg >= 100) return `相當於 ${Math.round(carbonKg / 7)} 個人一個月的呼吸排碳量`
  if (carbonKg >= 10) return `等同於 ${Math.round(carbonKg / 0.5)} 度電的碳排放量`
  return `等同於 ${Math.round(carbonKg * 2)} 頓廢紙回收的減碳效益`
}

// ── 方案 A：GPS × 生態層 × 氣象 × 動機推斷 → 環境詩學故事
async function generateStoryA(treeId) {
  const tree = getDb().prepare(`
    SELECT id, species, dbh_cm, carbon_kg, gps, created_at, confidence,
           reference_used, device_model
    FROM trees WHERE id = ?
  `).get(treeId)
  if (!tree || !process.env.GEMINI_API_KEY) return null

  const eco = getEcologyBySpecies(tree.species)
  const gps = parseGps(tree.gps)
  const region = guessRegion(gps?.lat, gps?.lng)

  // 氣象（非同步，無金鑰則 null）
  const weather = gps
    ? await getWeatherAt(gps.lat, gps.lng, tree.created_at).catch(() => null)
    : null
  const weatherLine = formatWeatherLine(weather)

  // 判斷 DBH 暗示的樹齡階段
  const dbh = tree.dbh_cm
  const sizeLabel = dbh < 5 ? '剛種下的幼苗' : dbh < 15 ? '成長中的小樹' : dbh < 30 ? '茁壯的青年樹' : '屹立多年的大樹'

  const prompt = `你是一位台灣生態詩人兼環境記者，請根據以下資料，為這棵樹寫一段**感性且有科學根基的繁體中文故事**（約 200–300 字）。

## 樹木資訊
- 樹種：${eco.zhName}（${tree.species}）
- 生長階段：${sizeLabel}（胸高直徑 ${tree.dbh_cm} cm）
- 碳儲量：${tree.carbon_kg} kg（${carbonToMeaning(tree.carbon_kg)}）
- 地點：${region}${gps ? `（${gps.lat.toFixed(4)}°N, ${gps.lng.toFixed(4)}°E）` : ''}
- 量測時間：${new Date(tree.created_at * 1000).toLocaleDateString('zh-TW')}
- 是否為原生樹種：${eco.origin === 'native' ? '是，台灣原生' : eco.origin === 'introduced' ? '否，引進種' : '未知'}
- 生態關鍵物種：${eco.keystone ? '是' : '否'}
- 吸引鳥類：${eco.birds.slice(0, 4).join('、')}
- 吸引昆蟲：${eco.insects.slice(0, 3).join('、')}
${weatherLine ? `- 當日氣象：${weatherLine}` : ''}

## 寫作要求
1. 以這棵樹的視角或旁觀者的視角，交織生態事實與情感
2. 至少提到一種吸引的鳥類或昆蟲，描述它們與這棵樹的關係
3. 提到這棵樹對土壤或周遭生態的貢獻（${eco.soilRole.slice(0, 50)}…）
4. 末段隱含「種樹是寫給未來的信」的主題
5. **不要**使用「的」字結尾的句子
6. 語氣溫暖，避免說教，讓讀者感到驚奇與希望

僅輸出故事正文，不加標題或前言。`

  const model = getClient().getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  const narrative = result.response.text().trim()

  // 建立完整 Markdown 故事頁
  const recordDate = new Date(tree.created_at * 1000).toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const markdown = `# 🌳 ${eco.zhName} 的故事

> **${region}** ｜ ${recordDate}

---

${getBiodiversityMarkdown(tree.species)}

---

## 🌍 碳儲量意義

這棵 ${eco.zhName} 目前儲存了 **${tree.carbon_kg} kg** 的碳。${carbonToMeaning(tree.carbon_kg)}。

每多一棵這樣的樹，就是給大氣的一次小小還債。

---

## ✨ 這棵樹的故事

${narrative}

---

${weatherLine ? `## 🌤 量測當日環境\n\n${weatherLine}\n\n---\n\n` : ''}_資料由 Forest Carbon Measurement 系統自動生成，Gemini 2.5 Flash 驅動，${new Date().toLocaleDateString('zh-TW')} 更新_`

  return { markdown, summary: `${eco.zhName}，${tree.dbh_cm} cm，${tree.carbon_kg} kg C，${region}`, weather }
}

// ── 方案 C：Event 形成 → 集體影響力故事
async function generateStoryC(eventId) {
  if (!process.env.GEMINI_API_KEY) return null

  const { getById, getTreesInEvent } = require('../db/events')
  const event = getById(eventId)
  const trees = getTreesInEvent(eventId)
  if (!trees.length) return null

  const speciesSummary = {}
  trees.forEach(t => {
    const name = t.species || '未知樹種'
    speciesSummary[name] = (speciesSummary[name] || 0) + 1
  })
  const speciesList = Object.entries(speciesSummary)
    .map(([s, n]) => `${getEcologyBySpecies(s).zhName} × ${n}`)
    .join('、')

  const totalCarbon = trees.reduce((s, t) => s + (t.carbon_kg || 0), 0)
  const prompt = `請用溫暖的繁體中文（約 150 字），描述一群人在同一天種下 ${trees.length} 棵樹的集體力量。
樹種組成：${speciesList}。
總碳儲量：${Math.round(totalCarbon)} kg。
地點：${event.name}，${event.date}。
強調集體行動的碳匯意義，以及這批樹木未來對生態多樣性的貢獻。**不要**用「的」結尾的句子。`

  const model = getClient().getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  const narrative = result.response.text().trim()

  const markdown = `## 🌱 集體種植故事

**${event.name}**｜${event.date}｜共 ${trees.length} 棵樹｜${Math.round(totalCarbon)} kg 碳

${narrative}`

  return markdown
}

// ── 方案 D：回訪時間對比
async function generateStoryD(oldTreeId, newTreeId) {
  if (!process.env.GEMINI_API_KEY) return null

  const db = getDb()
  const oldTree = db.prepare('SELECT * FROM trees WHERE id = ?').get(oldTreeId)
  const newTree = db.prepare('SELECT * FROM trees WHERE id = ?').get(newTreeId)
  if (!oldTree || !newTree) return null

  const eco = getEcologyBySpecies(newTree.species)
  const daysDiff = Math.round((newTree.created_at - oldTree.created_at) / 86400)
  const dbhGrowth = Math.round((newTree.dbh_cm - oldTree.dbh_cm) * 10) / 10
  const carbonGrowth = Math.round((newTree.carbon_kg - oldTree.carbon_kg) * 10) / 10

  const prompt = `這棵 ${eco.zhName} 在 ${daysDiff} 天後被再次量測。
初次：DBH ${oldTree.dbh_cm} cm，碳儲量 ${oldTree.carbon_kg} kg
再訪：DBH ${newTree.dbh_cm} cm（成長 ${dbhGrowth} cm），碳儲量 ${newTree.carbon_kg} kg（增加 ${carbonGrowth} kg）

請用約 120 字的繁體中文，以詩意方式描述這段時間裡這棵樹的成長，並提到這段期間它可能提供了什麼樣的生態服務（${eco.birds[0]}、${eco.insects[0]}等）。**不要**用「的」結尾的句子。`

  const model = getClient().getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  const narrative = result.response.text().trim()

  return `## 📅 成長回訪紀錄

| | 初次量測 | 再訪量測 | 變化 |
|--|--|--|--|
| **日期** | ${new Date(oldTree.created_at * 1000).toLocaleDateString('zh-TW')} | ${new Date(newTree.created_at * 1000).toLocaleDateString('zh-TW')} | +${daysDiff} 天 |
| **DBH** | ${oldTree.dbh_cm} cm | ${newTree.dbh_cm} cm | +${dbhGrowth} cm |
| **碳儲量** | ${oldTree.carbon_kg} kg | ${newTree.carbon_kg} kg | +${carbonGrowth} kg |

${narrative}`
}

module.exports = { generateStoryA, generateStoryC, generateStoryD }
