// 感光元件寬度（mm）與像素間距（μm）對照表
// 資料來源：各廠商規格表
const SENSOR_DB = {
  // iPhone 系列（主鏡頭 wide camera）
  'iPhone 13 Pro Max': { sensorWidth: 7.6, pixelPitch: 1.9 },
  'iPhone 13 Pro':     { sensorWidth: 7.6, pixelPitch: 1.9 },
  'iPhone 13':         { sensorWidth: 6.4, pixelPitch: 1.7 },
  'iPhone 12 Pro Max': { sensorWidth: 7.6, pixelPitch: 1.7 },
  'iPhone 12 Pro':     { sensorWidth: 6.4, pixelPitch: 1.7 },
  'iPhone 12':         { sensorWidth: 6.4, pixelPitch: 1.7 },
  'iPhone 14 Pro Max': { sensorWidth: 8.0, pixelPitch: 1.9 },
  'iPhone 14 Pro':     { sensorWidth: 8.0, pixelPitch: 1.9 },
  'iPhone 14':         { sensorWidth: 6.4, pixelPitch: 1.7 },
  'iPhone 15 Pro Max': { sensorWidth: 8.0, pixelPitch: 1.9 },
  'iPhone 15 Pro':     { sensorWidth: 8.0, pixelPitch: 1.9 },
  'iPhone 15':         { sensorWidth: 6.4, pixelPitch: 1.7 },
  'iPhone 16 Pro Max': { sensorWidth: 8.0, pixelPitch: 1.9 },
  'iPhone 16 Pro':     { sensorWidth: 8.0, pixelPitch: 1.9 },
  'iPhone 16':         { sensorWidth: 6.4, pixelPitch: 1.7 },
  // Samsung Galaxy S 系列
  'SM-S908B': { sensorWidth: 7.6, pixelPitch: 1.8 }, // S22 Ultra
  'SM-S918B': { sensorWidth: 8.4, pixelPitch: 2.0 }, // S23 Ultra
  'SM-S928B': { sensorWidth: 8.4, pixelPitch: 2.0 }, // S24 Ultra
  'SM-S721B': { sensorWidth: 6.4, pixelPitch: 1.6 }, // S24
  // Google Pixel
  'Pixel 7 Pro': { sensorWidth: 8.4, pixelPitch: 2.0 },
  'Pixel 7':     { sensorWidth: 6.4, pixelPitch: 1.7 },
  'Pixel 8 Pro': { sensorWidth: 8.4, pixelPitch: 2.0 },
  'Pixel 8':     { sensorWidth: 6.4, pixelPitch: 1.7 },
}

const DEFAULT_SENSOR = { sensorWidth: 6.4, pixelPitch: 1.7, isDefault: true }

function getSensorInfo(model) {
  if (!model) return { ...DEFAULT_SENSOR }
  // 嘗試完整比對，再嘗試部分比對
  if (SENSOR_DB[model]) return { ...SENSOR_DB[model], isDefault: false }
  const key = Object.keys(SENSOR_DB).find(k => model.includes(k) || k.includes(model))
  if (key) return { ...SENSOR_DB[key], isDefault: false }
  return { ...DEFAULT_SENSOR }
}

module.exports = { getSensorInfo }
