const { GoogleGenerativeAI } = require('@google/generative-ai')
const { getEcologyBySpecies, getBiodiversityMarkdown, getSeasonalBehavior } = require('../data/ecologyDb')
const { getWeatherAt, formatWeatherLine, bearingToText } = require('./weatherService')
const { getByTreeId: getEnvCtxByTreeId } = require('../db/environmentalContext')
const {
  FOREST_ZONE_LABEL_ZH,
  SEASON_LABEL_ZH,
  describePhenology,
} = require('./phenologyService')
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

// 將拍攝時間 unix 轉為當月編號
function getMonthFromUnix(unixTs) {
  if (!unixTs) return null
  return new Date(unixTs * 1000).getMonth() + 1
}

// 將 environmental_context 一列轉成可讀的環境快照 markdown 區塊
function buildEnvSnapshotMarkdown(env) {
  if (!env) return null
  const lines = []
  // 天氣
  const weatherBits = []
  if (env.weather_text) weatherBits.push(env.weather_text)
  if (env.temp_c != null) weatherBits.push(`氣溫 ${env.temp_c}°C`)
  if (env.humidity_pct != null) weatherBits.push(`濕度 ${env.humidity_pct}%`)
  if (env.pressure_hpa != null) weatherBits.push(`氣壓 ${env.pressure_hpa} hPa`)
  if (env.precip_mm != null && env.precip_mm > 0) weatherBits.push(`降水 ${env.precip_mm} mm`)
  if (env.cloud_cover_pct != null) weatherBits.push(`雲量 ${env.cloud_cover_pct}%`)
  if (weatherBits.length) lines.push(`- **天氣**：${weatherBits.join('、')}`)

  // 風
  if (env.wind_speed_ms != null || env.wind_dir_deg != null) {
    const dirText = bearingToText(env.wind_dir_deg)
    const windBits = []
    if (dirText) windBits.push(`${dirText}風`)
    if (env.wind_speed_ms != null) windBits.push(`${env.wind_speed_ms} m/s`)
    if (windBits.length) lines.push(`- **風況**：${windBits.join('，')}`)
  }

  // 輻射 / UV / 日照
  const lightBits = []
  if (env.uv_index != null) lightBits.push(`UV 指數 ${env.uv_index}`)
  if (env.sunshine_duration_h != null) lightBits.push(`日照 ${env.sunshine_duration_h} 小時`)
  if (env.shortwave_radiation_wm2 != null) lightBits.push(`短波輻射 ${env.shortwave_radiation_wm2} W/m²`)
  if (lightBits.length) lines.push(`- **光環境**：${lightBits.join('、')}`)

  // 太陽位置
  const sunBits = []
  if (env.sunrise) sunBits.push(`日出 ${new Date(env.sunrise * 1000).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`)
  if (env.sunset) sunBits.push(`日落 ${new Date(env.sunset * 1000).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`)
  if (env.day_length_h != null) sunBits.push(`日長 ${env.day_length_h} 小時`)
  if (env.solar_elevation_deg != null) sunBits.push(`太陽仰角 ${env.solar_elevation_deg}°`)
  if (env.solar_azimuth_deg != null) sunBits.push(`方位 ${env.solar_azimuth_deg}°`)
  if (sunBits.length) lines.push(`- **太陽位置**：${sunBits.join('、')}`)

  // 海拔 / 林帶 / 季節
  const placeBits = []
  if (env.altitude_m != null) placeBits.push(`海拔 ${Math.round(env.altitude_m)} m`)
  if (env.forest_zone) placeBits.push(FOREST_ZONE_LABEL_ZH[env.forest_zone] || env.forest_zone)
  if (env.season) placeBits.push(SEASON_LABEL_ZH[env.season] || env.season)
  if (placeBits.length) lines.push(`- **棲地座標**：${placeBits.join('、')}`)

  // 物候標籤
  const tags = Array.isArray(env.phenology_tags) ? env.phenology_tags : []
  if (tags.length) {
    const phen = describePhenology(tags)
    if (phen) lines.push(`- **當下物候**：${phen}`)
  }

  return lines.length ? lines.join('\n') : null
}

// ── 方案 A：GPS × 生態層 × 環境快照 × 物候 × 樹種雙軸敘事
async function generateStoryA(treeId) {
  const tree = getDb().prepare(`
    SELECT id, species, dbh_cm, carbon_kg, gps, created_at, confidence,
           reference_used, device_model, altitude_m, create_date
    FROM trees WHERE id = ?
  `).get(treeId)
  if (!tree || !process.env.GEMINI_API_KEY) return null

  const eco = getEcologyBySpecies(tree.species)
  const gps = parseGps(tree.gps)
  const region = guessRegion(gps?.lat, gps?.lng)

  // 環境快照：優先讀 environmental_context（包含天氣、UV、日照、太陽位置、物候）
  const env = getEnvCtxByTreeId(treeId)

  // 物候 × 樹種雙軸：拍攝當月的物種敘述
  const captureUnix = tree.create_date || env?.measured_at || tree.created_at
  const month = getMonthFromUnix(captureUnix)
  const speciesSeasonalNote = getSeasonalBehavior(tree.species, month)

  // 向下相容：若 environmental_context 不存在，仍可呼叫舊 weatherService 取得簡易天氣
  let legacyWeather = null
  let legacyWeatherLine = null
  if (!env && gps) {
    legacyWeather = await getWeatherAt(gps.lat, gps.lng, captureUnix).catch(() => null)
    legacyWeatherLine = formatWeatherLine(legacyWeather)
  }

  // 判斷 DBH 暗示的樹齡階段
  const dbh = tree.dbh_cm
  const sizeLabel = dbh < 5 ? '剛種下的幼苗' : dbh < 15 ? '成長中的小樹' : dbh < 30 ? '茁壯的青年樹' : '屹立多年的大樹'

  // 環境細節（餵 Gemini 的隱藏資料層）
  const envPromptLines = []
  if (env) {
    if (env.weather_text) envPromptLines.push(`- 天氣：${env.weather_text}`)
    if (env.temp_c != null) envPromptLines.push(`- 氣溫：${env.temp_c}°C`)
    if (env.humidity_pct != null) envPromptLines.push(`- 濕度：${env.humidity_pct}%`)
    if (env.pressure_hpa != null) envPromptLines.push(`- 氣壓：${env.pressure_hpa} hPa`)
    if (env.wind_speed_ms != null) {
      const dir = bearingToText(env.wind_dir_deg)
      envPromptLines.push(`- 風：${dir ? `${dir}風 ` : ''}${env.wind_speed_ms} m/s`)
    }
    if (env.uv_index != null) envPromptLines.push(`- UV 指數：${env.uv_index}`)
    if (env.sunshine_duration_h != null) envPromptLines.push(`- 當日日照：${env.sunshine_duration_h} 小時`)
    if (env.cloud_cover_pct != null) envPromptLines.push(`- 雲量：${env.cloud_cover_pct}%`)
    if (env.altitude_m != null) envPromptLines.push(`- 海拔：${Math.round(env.altitude_m)} 公尺`)
    if (env.forest_zone) envPromptLines.push(`- 林帶：${FOREST_ZONE_LABEL_ZH[env.forest_zone] || env.forest_zone}`)
    if (env.season) envPromptLines.push(`- 季節：${SEASON_LABEL_ZH[env.season] || env.season}`)
    const tags = Array.isArray(env.phenology_tags) ? env.phenology_tags : []
    if (tags.length) envPromptLines.push(`- 當下物候現象：${describePhenology(tags)}`)
  } else if (legacyWeatherLine) {
    envPromptLines.push(`- 當日氣象：${legacyWeatherLine}`)
  }

  const prompt = `你是一位台灣生態詩人兼環境記者，請根據以下資料，為這棵樹寫一段**感性且有科學根基的繁體中文故事**（約 250–350 字）。

## 樹木資訊
- 樹種：${eco.zhName}（${tree.species}）
- 生長階段：${sizeLabel}（胸高直徑 ${tree.dbh_cm} cm）
- 碳儲量：${tree.carbon_kg} kg（${carbonToMeaning(tree.carbon_kg)}）
- 地點：${region}${gps ? `（${gps.lat.toFixed(4)}°N, ${gps.lng.toFixed(4)}°E）` : ''}
- 量測時間：${new Date(captureUnix * 1000).toLocaleDateString('zh-TW')}
- 是否為原生樹種：${eco.origin === 'native' ? '是，台灣原生' : eco.origin === 'introduced' ? '否，引進種' : '未知'}
- 生態關鍵物種：${eco.keystone ? '是' : '否'}
- 吸引鳥類：${eco.birds.slice(0, 5).join('、')}
- 吸引昆蟲：${eco.insects.slice(0, 4).join('、')}

${speciesSeasonalNote ? `## 拍攝當月此樹種的物候活動\n${speciesSeasonalNote}` : ''}

${envPromptLines.length ? `## 拍攝當下環境快照（拍攝瞬間真實環境，請自然融入敘事）\n${envPromptLines.join('\n')}` : ''}

## 寫作要求
1. **雙軸敘事**：將樹種特性 × 拍攝當下的季節物候交織描寫，讓讀者感受到「這一刻，這棵樹周遭正在發生什麼」
2. 自然融入 1-2 項環境細節（如氣溫、UV、雲量、風向、日照時長），用詩意語言而非數字堆砌
3. 至少提到一種此樹當月會吸引的鳥類、昆蟲或哺乳類，描寫它們在此刻的具體行為
4. 提到這棵樹對土壤或周遭生態的貢獻（${eco.soilRole.slice(0, 60)}）
5. 末段隱含「種樹是寫給未來的信」的主題
6. **不要**使用「的」字結尾的句子，改用完整謂語結構
7. 語氣溫暖，避免說教，讓讀者感到驚奇與希望

僅輸出故事正文，不加標題或前言。`

  const model = getClient().getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  const narrative = result.response.text().trim()

  // 建立完整 Markdown 故事頁
  const recordDate = new Date(captureUnix * 1000).toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const envSnapshotMd = buildEnvSnapshotMarkdown(env)
  const envSection = envSnapshotMd
    ? `## 📊 拍攝當下環境快照\n\n${envSnapshotMd}\n\n---\n\n`
    : legacyWeatherLine
      ? `## 🌤 量測當日環境\n\n${legacyWeatherLine}\n\n---\n\n`
      : ''

  const seasonalSection = speciesSeasonalNote
    ? `## 🍃 此刻的 ${eco.zhName}（${month} 月）\n\n${speciesSeasonalNote}\n\n---\n\n`
    : ''

  const markdown = `# 🌳 ${eco.zhName} 的故事

> **${region}** ｜ ${recordDate}

---

${getBiodiversityMarkdown(tree.species)}

---

${seasonalSection}## 🌍 碳儲量意義

這棵 ${eco.zhName} 目前儲存了 **${tree.carbon_kg} kg** 的碳。${carbonToMeaning(tree.carbon_kg)}。

每多一棵這樣的樹，就是給大氣的一次小小還債。

---

## ✨ 這棵樹的故事

${narrative}

---

${envSection}_資料由 Forest Carbon Measurement 系統自動生成，Gemini 2.5 Flash 驅動，${new Date().toLocaleDateString('zh-TW')} 更新_`

  return {
    markdown,
    summary: `${eco.zhName}，${tree.dbh_cm} cm，${tree.carbon_kg} kg C，${region}`,
    weather: env || legacyWeather,
  }
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
