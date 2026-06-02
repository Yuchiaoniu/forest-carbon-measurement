// 環境快照服務（Open-Meteo + 本地太陽演算 + 物候推算）
// - getEnvironmentSnapshot()  整合：天氣 + 太陽位置 + 物候標籤
// - persistEnvironmentContext() 一次性寫入 environmental_context 資料表
// - getWeatherAt() / formatWeatherLine()  向下相容舊呼叫者
const axios = require('axios')
const solarService = require('./solarService')
const phenologyService = require('./phenologyService')
const environmentalContext = require('../db/environmentalContext')

// WMO Weather Interpretation Codes → 中文敘事
const WMO_WEATHER_TEXT_ZH = {
  0: '晴朗無雲',
  1: '大致晴朗',
  2: '局部多雲',
  3: '陰天',
  45: '起霧',
  48: '凍霧沉積',
  51: '小毛毛雨',
  53: '中等毛毛雨',
  55: '大毛毛雨',
  56: '小凍毛雨',
  57: '大凍毛雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  66: '小凍雨',
  67: '大凍雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  77: '雪粒',
  80: '小陣雨',
  81: '中陣雨',
  82: '強陣雨',
  85: '小陣雪',
  86: '大陣雪',
  95: '雷雨',
  96: '雷雨夾小冰雹',
  99: '雷雨夾大冰雹',
}

function describeWmoCode(code) {
  if (code == null) return null
  return WMO_WEATHER_TEXT_ZH[code] || `天氣代碼 ${code}`
}

// 從 Open-Meteo 回傳的 hourly 序列中挑出最接近 unixTs 的那一小時
function pickClosestHour(data, unixTs) {
  const times = data?.hourly?.time
  if (!Array.isArray(times) || times.length === 0) return null
  const targetMs = unixTs * 1000
  let bestIdx = 0
  let bestDiff = Infinity
  for (let i = 0; i < times.length; i++) {
    const diff = Math.abs(new Date(times[i]).getTime() - targetMs)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIdx = i
    }
  }
  const h = data.hourly
  const v = (arr) => (Array.isArray(arr) ? arr[bestIdx] ?? null : null)
  const round = (x, p = 1) => (x == null ? null : Math.round(x * 10 ** p) / 10 ** p)
  return {
    tempC: round(v(h.temperature_2m), 1),
    humidityPct: v(h.relative_humidity_2m),
    pressureHpa: round(v(h.surface_pressure), 1),
    windDirDeg: v(h.wind_direction_10m),
    windSpeedMs: round(v(h.wind_speed_10m), 1),
    weatherCode: v(h.weather_code),
    precipMm: round(v(h.precipitation), 2),
    cloudCoverPct: v(h.cloud_cover),
    uvIndex: round(v(h.uv_index), 1),
    sunshineDurationH:
      v(h.sunshine_duration) != null ? round(v(h.sunshine_duration) / 3600, 2) : null,
    shortwaveRadiationWm2: round(v(h.shortwave_radiation), 1),
  }
}

// 主要的 Open-Meteo 抓取邏輯
// - 過去 92 天內：Forecast API（含 UV 指數）
// - 更早：Archive API（ERA5 重分析，無 UV）
async function fetchOpenMeteo(lat, lng, unixTs) {
  const now = Math.floor(Date.now() / 1000)
  const ageDays = (now - unixTs) / 86400
  const dateStr = new Date(unixTs * 1000).toISOString().slice(0, 10)

  let url, params
  if (ageDays >= 0 && ageDays <= 92) {
    url = 'https://api.open-meteo.com/v1/forecast'
    params = {
      latitude: lat,
      longitude: lng,
      hourly:
        'temperature_2m,relative_humidity_2m,surface_pressure,wind_direction_10m,wind_speed_10m,' +
        'weather_code,precipitation,cloud_cover,uv_index,shortwave_radiation,sunshine_duration',
      start_date: dateStr,
      end_date: dateStr,
      wind_speed_unit: 'ms',
      timezone: 'auto',
    }
  } else {
    url = 'https://archive-api.open-meteo.com/v1/archive'
    params = {
      latitude: lat,
      longitude: lng,
      hourly:
        'temperature_2m,relative_humidity_2m,surface_pressure,wind_direction_10m,wind_speed_10m,' +
        'weather_code,precipitation,cloud_cover,shortwave_radiation,sunshine_duration',
      start_date: dateStr,
      end_date: dateStr,
      wind_speed_unit: 'ms',
      timezone: 'auto',
    }
  }

  const resp = await axios.get(url, { params, timeout: 8000 })
  const snap = pickClosestHour(resp.data, unixTs)
  if (!snap) return null
  snap.raw = resp.data
  snap.source = ageDays <= 92 ? 'open-meteo-forecast' : 'open-meteo-archive'
  return snap
}

// 整合一次性環境快照
async function getEnvironmentSnapshot(lat, lng, unixTs, altitudeM = null) {
  if (lat == null || lng == null || !unixTs) return null

  // 並行：Open-Meteo 天氣 + 本地太陽位置
  const [omRes, sunRes] = await Promise.allSettled([
    fetchOpenMeteo(lat, lng, unixTs),
    Promise.resolve(solarService.getSunPosition(lat, lng, unixTs)),
  ])

  const om = omRes.status === 'fulfilled' ? omRes.value : null
  const sun = sunRes.status === 'fulfilled' ? sunRes.value : null

  if (!om && !sun) return null

  // 物候推算（本地、純規則）
  const phenologyTags = phenologyService.inferPhenologyTags({ unixTs, lat, altitudeM })
  const forestZone = phenologyService.inferForestZone(altitudeM)
  const month = new Date(unixTs * 1000).getMonth() + 1
  const season = phenologyService.inferSeason(month, lat)

  return {
    // 位置
    lat,
    lon: lng,
    altitudeM,
    measuredAt: unixTs,
    // 季節 / 林帶 / 物候
    season,
    forestZone,
    phenologyTags,
    // 天氣
    tempC: om?.tempC ?? null,
    humidityPct: om?.humidityPct ?? null,
    pressureHpa: om?.pressureHpa ?? null,
    windDirDeg: om?.windDirDeg ?? null,
    windSpeedMs: om?.windSpeedMs ?? null,
    weatherCode: om?.weatherCode ?? null,
    weatherText: om ? describeWmoCode(om.weatherCode) : null,
    precipMm: om?.precipMm ?? null,
    cloudCoverPct: om?.cloudCoverPct ?? null,
    // 輻射 / UV / 日照
    uvIndex: om?.uvIndex ?? null,
    sunshineDurationH: om?.sunshineDurationH ?? null,
    shortwaveRadiationWm2: om?.shortwaveRadiationWm2 ?? null,
    // 太陽位置
    sunrise: sun?.sunrise ?? null,
    sunset: sun?.sunset ?? null,
    dayLengthH: sun?.dayLengthH ?? null,
    solarElevationDeg: sun?.solarElevationDeg ?? null,
    solarAzimuthDeg: sun?.solarAzimuthDeg ?? null,
    // 原始保存
    rawOpenmeteoJson: om?.raw || null,
    rawCwaJson: null, // 預留欄位，未來接 CWA 觀測資料
  }
}

// 寫入 environmental_context 資料表（fire-and-forget 安全）
async function persistEnvironmentContext(treeId, lat, lng, unixTs, altitudeM = null) {
  if (!treeId) return null
  if (lat == null || lng == null || !unixTs) {
    console.log(`[envctx] tree=${treeId} 缺少 GPS 或時間戳，跳過環境快照`)
    return null
  }
  try {
    const snap = await getEnvironmentSnapshot(lat, lng, unixTs, altitudeM)
    if (!snap) {
      console.warn(`[envctx] tree=${treeId} 環境快照為空`)
      return null
    }
    const id = environmentalContext.insert({
      treeId,
      measuredAt: snap.measuredAt,
      lat: snap.lat,
      lon: snap.lon,
      altitudeM: snap.altitudeM,
      season: snap.season,
      forestZone: snap.forestZone,
      tempC: snap.tempC,
      humidityPct: snap.humidityPct,
      pressureHpa: snap.pressureHpa,
      windDirDeg: snap.windDirDeg,
      windSpeedMs: snap.windSpeedMs,
      weatherCode: snap.weatherCode,
      weatherText: snap.weatherText,
      precipMm: snap.precipMm,
      cloudCoverPct: snap.cloudCoverPct,
      uvIndex: snap.uvIndex,
      sunshineDurationH: snap.sunshineDurationH,
      shortwaveRadiationWm2: snap.shortwaveRadiationWm2,
      sunrise: snap.sunrise,
      sunset: snap.sunset,
      dayLengthH: snap.dayLengthH,
      solarElevationDeg: snap.solarElevationDeg,
      solarAzimuthDeg: snap.solarAzimuthDeg,
      phenologyTags: snap.phenologyTags,
      rawOpenmeteoJson: snap.rawOpenmeteoJson,
      rawCwaJson: snap.rawCwaJson,
    })
    console.log(
      `[envctx] tree=${treeId} 環境快照已寫入 id=${id} weather=${snap.weatherText || 'n/a'} ` +
        `temp=${snap.tempC ?? 'n/a'}°C uv=${snap.uvIndex ?? 'n/a'} ` +
        `phenology=${(snap.phenologyTags || []).length} tags`,
    )
    return id
  } catch (err) {
    console.warn(`[envctx] tree=${treeId} 環境快照寫入失敗（優雅降級）：${err.message}`)
    return null
  }
}

// 風向角度 → 8 方位文字
function bearingToText(deg) {
  if (deg == null) return null
  const dirs = ['北', '東北', '東', '東南', '南', '西南', '西', '西北']
  const idx = Math.round(((deg % 360) / 45)) % 8
  return dirs[idx]
}

// ── 向下相容包裝（給舊呼叫者使用）─────────────────────
async function getWeatherAt(lat, lng, unixTimestamp) {
  if (lat == null || lng == null || !unixTimestamp) return null
  try {
    const om = await fetchOpenMeteo(lat, lng, unixTimestamp)
    if (!om) return null
    return {
      tempC: om.tempC,
      humidity: om.humidityPct,
      description: describeWmoCode(om.weatherCode) || '',
      windSpeedMs: om.windSpeedMs,
      sunrise: null,
      sunset: null,
    }
  } catch (err) {
    console.warn('[weather] 氣象查詢失敗（優雅降級）：', err.message)
    return null
  }
}

function formatWeatherLine(weather) {
  if (!weather) return null
  const parts = []
  if (weather.description) parts.push(weather.description)
  if (weather.tempC != null) parts.push(`氣溫 ${weather.tempC}°C`)
  if (weather.humidity != null) parts.push(`濕度 ${weather.humidity}%`)
  if (weather.windSpeedMs != null) parts.push(`風速 ${weather.windSpeedMs} m/s`)
  return parts.join('、')
}

module.exports = {
  getWeatherAt,
  formatWeatherLine,
  getEnvironmentSnapshot,
  persistEnvironmentContext,
  describeWmoCode,
  bearingToText,
}
