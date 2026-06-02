const { getDb } = require('./init')
const { randomUUID } = require('crypto')

function findByVideoHash(videoHash) {
  return getDb().prepare('SELECT * FROM trees WHERE video_hash = ?').get(videoHash)
}

function insert(data) {
  const id = randomUUID()
  const p = data.paths || {}
  const p0 = p.path0, pA = p.pathA, pB = p.pathB
  getDb().prepare(`
    INSERT INTO trees (id, plot_id, video_hash, species, species_source, dbh_cm,
      volume_m3, carbon_kg, confidence, gps, focal_length_mm, sensor_width_mm,
      device_model, frame_quality, raw_result, original_dbh_cm, applied_correction_factor,
      video_filename, video_original_name,
      path0_dbh_cm, pathA_dbh_cm, pathB_dbh_cm, pathB_dbh_cm_corrected,
      path0_volume_m3, pathA_volume_m3, pathB_volume_m3,
      path0_carbon_kg, pathA_carbon_kg, pathB_carbon_kg, winner_path,
      create_date, frame_rate, image_width, image_height, altitude_m,
      illuminance_lux, duration_sec, video_codec, orientation,
      gps_img_direction_deg, device_pressure_hpa, device_ambient_temp_c)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.plotId || null, data.videoHash, data.species, data.speciesSource,
    data.dbhCm, data.volumeM3, data.carbonKg, data.confidence, data.gps,
    data.focalLengthMm, data.sensorWidthMm, data.deviceModel, data.frameQuality,
    JSON.stringify(data.rawResult || {}),
    data.originalDbhCm ?? null, data.appliedCorrectionFactor ?? null,
    data.videoFilename ?? null, data.videoOriginalName ?? null,
    p0?.dbhCm ?? null, pA?.dbhCm ?? null, pB?.dbhCm ?? null, data.pathBDbhCmCorrected ?? null,
    p0?.volumeM3 ?? null, pA?.volumeM3 ?? null, pB?.volumeM3 ?? null,
    p0?.carbonKg ?? null, pA?.carbonKg ?? null, pB?.carbonKg ?? null,
    data.winnerPath ?? null,
    data.createDate ?? null, data.frameRate ?? null,
    data.imageWidth ?? null, data.imageHeight ?? null, data.altitudeM ?? null,
    data.illuminanceLux ?? null, data.durationSec ?? null,
    data.videoCodec ?? null, data.orientation ?? null,
    data.gpsImgDirectionDeg ?? null, data.devicePressureHpa ?? null, data.deviceAmbientTempC ?? null
  )
  return id
}

function updateTxHash(id, txHash, txStatus = 'confirmed') {
  getDb().prepare('UPDATE trees SET tx_hash = ?, tx_status = ? WHERE id = ?')
    .run(txHash, txStatus, id)
}

function getPendingTx() {
  return getDb().prepare("SELECT * FROM trees WHERE tx_status = 'pending' AND tx_hash IS NULL").all()
}

module.exports = { findByVideoHash, insert, updateTxHash, getPendingTx }
