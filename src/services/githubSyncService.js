const { getDb } = require('../db/init')

const REPO   = process.env.GITHUB_REPO   || 'Yuchiaoniu/forest-carbon-measurement'
const BRANCH = process.env.GITHUB_BRANCH || 'master'

async function ghRequest(method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization:  `token ${process.env.GITHUB_TOKEN}`,
      Accept:         'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent':   'forest-carbon-measurement',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res
}

async function upsertFile(filePath, contentStr, commitMsg) {
  const content = Buffer.from(contentStr).toString('base64')

  let sha = null
  const getRes = await ghRequest('GET', `/repos/${REPO}/contents/${filePath}?ref=${BRANCH}`)
  if (getRes.ok) sha = (await getRes.json()).sha

  const putRes = await ghRequest('PUT', `/repos/${REPO}/contents/${filePath}`, {
    message: commitMsg,
    content,
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  })

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}))
    throw new Error(err.message || `HTTP ${putRes.status}`)
  }
}

function buildTrees() {
  const rows = getDb().prepare(`
    SELECT
      t.id, t.species, t.species_source, t.dbh_cm, t.volume_m3,
      t.carbon_kg, t.confidence, t.gps, t.focal_length_mm, t.sensor_width_mm,
      t.device_model, t.frame_quality, t.reference_used, t.reference_type,
      t.original_dbh_cm, t.applied_correction_factor, t.created_at,
      t.tx_hash, t.tx_status, t.raw_result,
      gt.actual_dbh_cm AS ref_dbh_cm, gt.source AS gt_source,
      CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS has_story,
      s.markdown AS story_markdown, s.summary AS story_summary
    FROM trees t
    LEFT JOIN ground_truth gt ON gt.id = (
      SELECT id FROM ground_truth WHERE tree_id = t.id ORDER BY created_at DESC LIMIT 1
    )
    LEFT JOIN stories s ON s.tree_id = t.id AND s.story_type = 'A'
    ORDER BY t.created_at ASC
  `).all()

  return rows.map((r, i) => {
    let raw = null
    try { raw = r.raw_result ? JSON.parse(r.raw_result) : null } catch (_) {}
    const meta = raw?.metadata || null
    return {
      treeNo:                  `T${String(i + 1).padStart(3, '0')}`,
      id:                      r.id,
      species:                 r.species || '未辨識',
      speciesSource:           r.species_source,
      dbhCm:                   r.dbh_cm,
      originalDbhCm:           r.original_dbh_cm,
      appliedCorrectionFactor: r.applied_correction_factor,
      volumeM3:                r.volume_m3,
      carbonKg:                r.carbon_kg,
      confidence:              r.confidence,
      gps:                     r.gps,
      focalLengthMm:           r.focal_length_mm,
      sensorWidthMm:           r.sensor_width_mm,
      deviceModel:             r.device_model,
      frameQuality:            r.frame_quality,
      referenceUsed:           !!r.reference_used,
      referenceType:           r.reference_type,
      createdAt:               r.created_at,
      altitude:                meta?.altitudeM ?? meta?.altitude ?? null,
      resolution:              meta?.imageWidth && meta?.imageHeight
                                 ? `${meta.imageWidth} × ${meta.imageHeight}` : null,
      fps:                     meta?.frameRate ?? meta?.videoFrameRate ?? null,
      blockchain: {
        txHash:    r.tx_hash   || null,
        txStatus:  r.tx_status || 'none',
        createdAt: r.created_at || null,
      },
      calibration: r.ref_dbh_cm != null
        ? { dbhCm: r.ref_dbh_cm, source: r.gt_source } : null,
      hasStory:      !!r.has_story,
      storyMarkdown: r.story_markdown || null,
      storySummary:  r.story_summary  || null,
    }
  })
}

async function pushTreesJson() {
  if (!process.env.GITHUB_TOKEN) {
    console.warn('[github-sync] 未設定 GITHUB_TOKEN，跳過')
    return
  }
  try {
    const trees = buildTrees()
    const json  = JSON.stringify(trees, null, 2) + '\n'
    await upsertFile(
      'public/data/trees.json',
      json,
      `data: sync trees.json (${trees.length} 筆) [skip ci]`
    )
    console.log(`[github-sync] trees.json 同步完成（${trees.length} 筆）`)
    return trees.length
  } catch (err) {
    console.warn('[github-sync] 同步失敗（不影響主流程）：', err.message)
  }
}

module.exports = { pushTreesJson }
