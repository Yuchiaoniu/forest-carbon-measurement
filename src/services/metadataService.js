const { exiftool } = require('exiftool-vendored')
const { getSensorInfo } = require('../data/sensorDb')

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

  const altitude = tags.GPSAltitude
    ? parseFloat(String(tags.GPSAltitude).replace(/[^\d.]/g, ''))
    : null

  return {
    model,
    focalLengthMm: focalLength,
    sensorWidthMm: sensor.sensorWidth,
    pixelPitchUm: sensor.pixelPitch,
    sensorIsDefault: sensor.isDefault,
    imageWidth: tags.ImageWidth || tags.SourceImageWidth || 1920,
    imageHeight: tags.ImageHeight || tags.SourceImageHeight || 1080,
    gps,
    altitudeM: altitude,
    frameRate: tags.VideoFrameRate || null,
    createDate: tags.CreateDate || null,
    illuminanceLux: tags.SceneIlluminance || null,
  }
}

module.exports = { extractMetadata }
