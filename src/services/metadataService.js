const { exiftool } = require('exiftool-vendored')
const { getSensorInfo } = require('../data/sensorDb')

// 把 exiftool 回傳的物件轉成 JSON-safe（移除 Buffer、把 ExifDateTime 轉 ISO 字串、移除無法序列化的型別）
function toJsonSafe(obj) {
  if (obj == null) return obj
  if (typeof obj !== 'object') return obj
  if (Buffer.isBuffer(obj)) return `<Buffer ${obj.length}B>`
  if (obj instanceof Date) return obj.toISOString()
  // exiftool-vendored 的 ExifDateTime 有 rawValue / toISOString
  if (typeof obj.toISOString === 'function' && obj.rawValue) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(toJsonSafe)
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'function') continue
    if (k === 'SourceFile' || k === 'errors' || k === 'warnings') continue
    try {
      out[k] = toJsonSafe(v)
    } catch (_) {
      // 跳過無法序列化的欄位
    }
  }
  return out
}

function parseNumber(v) {
  if (v == null) return null
  const s = String(v).replace(/[^\d.\-]/g, '')
  if (!s) return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

// CreateDate 轉 unix epoch（秒）
function parseCreateDateToUnix(v) {
  if (!v) return null
  try {
    // exiftool-vendored ExifDateTime
    if (typeof v.toMillis === 'function') return Math.floor(v.toMillis() / 1000)
    if (typeof v.toDate === 'function') return Math.floor(v.toDate().getTime() / 1000)
    if (v instanceof Date) return Math.floor(v.getTime() / 1000)
    const d = new Date(String(v))
    if (!isNaN(d.getTime())) return Math.floor(d.getTime() / 1000)
  } catch (_) {}
  return null
}

async function extractMetadata(videoPath) {
  const tags = await exiftool.read(videoPath)

  const model = tags.Model || tags.DeviceModelName || null
  const sensor = getSensorInfo(model)

  // 直接焦距
  let focalLength = tags.FocalLength
    ? parseFloat(String(tags.FocalLength).replace(/[^\d.]/g, ''))
    : null

  // 備援1：從 35mm 等效焦距 + 感光元件寬度反推
  if (!focalLength) {
    const equiv35mm = tags.FocalLengthIn35mmFormat || tags['FocalLengthIn35mmFormat']
    const equiv = equiv35mm ? parseFloat(String(equiv35mm).replace(/[^\d.]/g, '')) : null
    if (equiv && sensor.sensorWidth) {
      focalLength = Math.round((equiv * sensor.sensorWidth / 36) * 100) / 100
    }
  }
  // 備援2：從設備資料庫直接取已知焦距
  if (!focalLength && sensor.focalLength) {
    focalLength = sensor.focalLength
  }

  let gps = null
  if (tags.GPSLatitude && tags.GPSLongitude) {
    gps = `${tags.GPSLatitude},${tags.GPSLongitude}`
  }

  const altitude = parseNumber(tags.GPSAltitude)
  const createDateUnix = parseCreateDateToUnix(tags.CreateDate || tags.DateTimeOriginal || tags.MediaCreateDate)

  // 完整封存（支柱一原始設計：所有可得元數據都應寫入本地資料庫）
  const exifRaw = toJsonSafe(tags)

  return {
    // 既有欄位（向後相容）
    model,
    focalLengthMm: focalLength,
    sensorWidthMm: sensor.sensorWidth,
    pixelPitchUm: sensor.pixelPitch,
    sensorIsDefault: sensor.isDefault,
    imageWidth: tags.ImageWidth || tags.SourceImageWidth || 1920,
    imageHeight: tags.ImageHeight || tags.SourceImageHeight || 1080,
    gps,
    altitudeM: altitude,
    frameRate: parseNumber(tags.VideoFrameRate),
    createDate: tags.CreateDate || null,
    illuminanceLux: parseNumber(tags.SceneIlluminance),

    // §27.7.5 新增：常用欄位拉出來方便 SQL 查詢
    createDateUnix,
    durationSec: parseNumber(tags.Duration || tags.MediaDuration || tags.TrackDuration),
    videoCodec: tags.CompressorID || tags.VideoCodec || tags.CompressorName || null,
    orientation: tags.Orientation ? String(tags.Orientation) : null,
    gpsImgDirectionDeg: parseNumber(tags.GPSImgDirection),
    devicePressureHpa: parseNumber(tags.Pressure || tags.AtmosphericPressure),
    deviceAmbientTempC: parseNumber(tags.AmbientTemperature),

    // 完整原始封存（永不缺資料）
    exifRaw,
  }
}

module.exports = { extractMetadata }
