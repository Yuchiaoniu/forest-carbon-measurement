const { getDb } = require('./init')
const { randomUUID } = require('crypto')

function findByVideoHash(videoHash) {
  return getDb().prepare('SELECT * FROM trees WHERE video_hash = ?').get(videoHash)
}

function insert(data) {
  const id = randomUUID()
  getDb().prepare(`
    INSERT INTO trees (id, plot_id, video_hash, species, species_source, dbh_cm,
      volume_m3, carbon_kg, confidence, gps, focal_length_mm, sensor_width_mm,
      device_model, frame_quality, raw_result, original_dbh_cm, applied_correction_factor,
      video_filename, video_original_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.plotId || null, data.videoHash, data.species, data.speciesSource,
    data.dbhCm, data.volumeM3, data.carbonKg, data.confidence, data.gps,
    data.focalLengthMm, data.sensorWidthMm, data.deviceModel, data.frameQuality,
    JSON.stringify(data.rawResult || {}),
    data.originalDbhCm ?? null, data.appliedCorrectionFactor ?? null,
    data.videoFilename ?? null, data.videoOriginalName ?? null
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
