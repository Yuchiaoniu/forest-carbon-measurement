const axios = require('axios')

// 查詢拍攝時間點的氣象資料
// 回傳：{ tempC, humidity, description, windSpeedMs, sunrise, sunset } 或 null
async function getWeatherAt(lat, lng, unixTimestamp) {
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) return null

  try {
    // OpenWeatherMap One Call 3.0 timemachine（歷史資料，需付費 API）
    // 若是過去 5 天內的時間用 timemachine；更早則直接回 null
    const nowSec = Math.floor(Date.now() / 1000)
    const ageDays = (nowSec - unixTimestamp) / 86400

    let data
    if (ageDays <= 5) {
      const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine`
      const resp = await axios.get(url, {
        params: { lat, lon: lng, dt: unixTimestamp, appid: apiKey, units: 'metric', lang: 'zh_tw' },
        timeout: 5000,
      })
      const hourly = resp.data.data?.[0]
      if (!hourly) return null
      data = {
        tempC: Math.round(hourly.temp * 10) / 10,
        humidity: hourly.humidity,
        description: hourly.weather?.[0]?.description || '',
        windSpeedMs: Math.round((hourly.wind_speed || 0) * 10) / 10,
        sunrise: resp.data.data[0]?.sunrise || null,
        sunset: resp.data.data[0]?.sunset || null,
      }
    } else {
      // 超過5天改抓當前天氣做參考（標記為近似）
      const url = `https://api.openweathermap.org/data/2.5/weather`
      const resp = await axios.get(url, {
        params: { lat, lon: lng, appid: apiKey, units: 'metric', lang: 'zh_tw' },
        timeout: 5000,
      })
      data = {
        tempC: Math.round(resp.data.main.temp * 10) / 10,
        humidity: resp.data.main.humidity,
        description: resp.data.weather?.[0]?.description || '',
        windSpeedMs: Math.round((resp.data.wind?.speed || 0) * 10) / 10,
        sunrise: resp.data.sys?.sunrise || null,
        sunset: resp.data.sys?.sunset || null,
        approximate: true,
      }
    }
    return data
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

module.exports = { getWeatherAt, formatWeatherLine }
