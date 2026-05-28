const { getDb } = require('./init')
const { randomUUID } = require('crypto')

const COLS = [
  'id', 'tree_id', 'frame_idx',
  'direct_measurement_cm', 'direct_confidence', 'measurement_type',
  'reference_detected', 'reference_at_trunk', 'reference_type',
  'reference_width_mm', 'reference_height_mm', 'reference_confidence',
  'trunk_width_fraction', 'reference_width_fraction', 'reference_height_fraction',
  'breast_height_visible', 'leaf_visible', 'frame_quality_label',
  'reference_orthogonal', 'reference_fully_visible',
  'raw_json',
]

function insertMany(treeId, frames) {
  if (!Array.isArray(frames) || frames.length === 0) return 0
  const db = getDb()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO frame_analyses (${COLS.join(', ')})
    VALUES (${COLS.map(() => '?').join(', ')})
  `)
  const tx = db.transaction((rows) => {
    for (const r of rows) stmt.run(...r)
  })
  const rows = frames.map((f, i) => [
    randomUUID(), treeId, f.frameIdx ?? i,
    f.directMeasurementCm ?? null,
    f.directMeasurementConfidence ?? null,
    f.measurementType ?? null,
    f.referenceDetected == null ? null : (f.referenceDetected ? 1 : 0),
    f.referenceAtTrunk == null ? null : (f.referenceAtTrunk ? 1 : 0),
    f.referenceType ?? null,
    f.referenceWidthMm ?? null,
    f.referenceHeightMm ?? null,
    f.referenceConfidence ?? null,
    f.trunkWidthFraction ?? null,
    f.referenceWidthFraction ?? null,
    f.referenceHeightFraction ?? null,
    f.breastHeightVisible == null ? null : (f.breastHeightVisible ? 1 : 0),
    f.leafVisible == null ? null : (f.leafVisible ? 1 : 0),
    f.frameQualityLabel ?? null,
    f.referenceOrthogonalToCamera == null ? null : (f.referenceOrthogonalToCamera ? 1 : 0),
    f.referenceFullyVisible == null ? null : (f.referenceFullyVisible ? 1 : 0),
    JSON.stringify(f),
  ])
  tx(rows)
  return rows.length
}

function getByTreeId(treeId) {
  const rows = getDb().prepare(
    'SELECT * FROM frame_analyses WHERE tree_id = ? ORDER BY frame_idx ASC'
  ).all(treeId)
  return rows.map(r => {
    try { r.raw = r.raw_json ? JSON.parse(r.raw_json) : null } catch (_) { r.raw = null }
    return r
  })
}

function deleteByTreeId(treeId) {
  return getDb().prepare('DELETE FROM frame_analyses WHERE tree_id = ?').run(treeId).changes
}

module.exports = { insertMany, getByTreeId, deleteByTreeId }
