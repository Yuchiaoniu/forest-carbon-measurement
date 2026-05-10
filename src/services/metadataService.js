const { exiftool } = require('exiftool-vendored')
const { getSensorInfo } = require('../data/sensorDb')

async function extractMetadata(videoPath) {
  const tags = await exiftool.read(videoPath)

  const model = tags.Model || tags.DeviceModelName || null
  const sensor = getSensorInfo(model)

  const focalLength = tags.FocalLength
    ? parseFloat(String(tags.FocalLength).replace(/[^\d.]/g, ''))
    : null

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
