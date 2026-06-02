require('dotenv').config()
const express = require('express')
const multer = require('multer')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')

const { extractMetadata } = require('./services/metadataService')
const { extractAndDetectCard, selectRegularFrames, frameToBase64 } = require('./services/frameService')
const { pickEvidenceFrameIdx, generateThumbnail } = require('./services/evidenceFrameService')
const { identifySpecies: plantnetIdentify } = require('./services/plantnetService')
const { identifySpecies: inaturalistIdentify } = require('./services/inaturalistService')
const { analyzeTrunkWithRetry, getMedianResult, identifySpeciesFallback, analyzeTrunkPathAOnly, getPathAMedianRatio } = require('./services/geminiService')
const { calculate } = require('./services/calculationService')
const { findByVideoHash, insert } = require('./db/trees')
const frameAnalyses = require('./db/frameAnalyses')
const { insert: insertGroundTruth, upsertManual: upsertManualGroundTruth, getByTreeId, getStats } = require('./db/groundTruth')
const { getBySpecies: getFactorLogBySpecies } = require('./db/correctionFactorLog')
const { create: createBlockchainJob, getPending, updateStatus, incrementRetry, getByTreeId: getJobByTreeId } = require('./db/blockchainJobs')
const { getFactorBySpecies, getAllFactors, snapshotFactor } = require('./services/correctionFactorService')
const { recordMeasurement } = require('./services/blockchainService')
const { runEvaluation, getLatestRun, exportCsv, buildDsrChecklist } = require('./services/evaluationService')
const { assignToEvent } = require('./services/clusterService')
const { generateStoryA, generateStoryC } = require('./services/storyService')
const { persistEnvironmentContext } = require('./services/weatherService')
const { insert: insertStory, getLatestByTree } = require('./db/stories')
const { pushTreesJson } = require('./services/githubSyncService')
const { getById: getEventById, getTreesInEvent, setStoryC } = require('./db/events')
const { getDb } = require('./db/init')

// === 觀測性：全域 crash logger ===
// 同步寫到 logs/crash.log，避開 PM2 stderr 在程序瞬死時來不及 flush 的問題
const LOG_DIR = path.join(process.cwd(), 'logs')
const CRASH_LOG = path.join(LOG_DIR, 'crash.log')
try { fs.mkdirSync(LOG_DIR, { recursive: true }) } catch (_) {}

function writeCrashLog(label, err) {
  const ts = new Date().toISOString()
  let inFlight = 'unknown'
  try {
    if (typeof jobs !== 'undefined' && jobs) {
      const list = Object.entries(jobs)
        .filter(([_, j]) => j && j.status === 'processing')
        .map(([id, j]) => `${id.slice(0, 8)}:${j.step || '?'}`)
      inFlight = list.length ? list.join(', ') : 'none'
    }
  } catch (_) {}
  const stack = err && err.stack ? err.stack : String(err)
  const entry = `\n=== ${ts} ${label} ===\nin-flight: ${inFlight}\n${stack}\n`
  try { fs.appendFileSync(CRASH_LOG, entry) } catch (_) {}
  try { fs.writeSync(2, entry) } catch (_) {}
}

process.on('uncaughtException', (err) => {
  writeCrashLog('uncaughtException', err)
  process.exit(1)
})
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason))
  writeCrashLog('unhandledRejection', err)
})
// === END 觀測性 ===

const app = express()
const PORT = process.env.PORT || 3000
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const EVIDENCE_DIR = path.join(UPLOAD_DIR, 'evidence')

// CORS：允許 GitHub Pages 跨域呼叫 API
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// 確保目錄存在
fs.mkdirSync(UPLOAD_DIR, { recursive: true })
fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
fs.mkdirSync('./tmp_frames', { recursive: true })

// 初始化 DB
getDb()

// Multer 設定
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
})
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (['.mov', '.mp4'].includes(ext)) cb(null, true)
    else cb(new Error('僅支援 .mov 及 .mp4 格式'))
  },
})

// 進度追蹤（in-memory，重啟後清空）
const jobs = {}

app.use(express.static(path.join(__dirname, '..', 'public')))

// POST /api/upload
app.post('/api/upload', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到影片' })

  const jobId = uuidv4()
  jobs[jobId] = { status: 'processing', step: 'hashing' }
  res.json({ jobId, status: 'processing' })

  // 非同步處理
  processVideo(jobId, req.file.path, req.file.originalname).catch(err => {
    jobs[jobId] = { status: 'error', error: err.message }
  })
})

// GET /api/status/:jobId
app.get('/api/status/:jobId', (req, res) => {
  const job = jobs[req.params.jobId]
  if (!job) return res.status(404).json({ error: 'Job 不存在' })
  res.json(job)
})

// POST /api/ground-truth（手動回報實測值）
app.use(express.json())
app.post('/api/ground-truth', (req, res) => {
  const { treeId, actualDbhCm } = req.body
  if (!treeId || !actualDbhCm) return res.status(400).json({ error: 'treeId 和 actualDbhCm 必填' })
  const tree = getDb().prepare('SELECT dbh_cm, species FROM trees WHERE id = ?').get(treeId)
  if (!tree) return res.status(404).json({ error: '找不到該筆測量紀錄' })
  const { id, correctionFactor } = insertGroundTruth({
    treeId, actualDbhCm, estimatedDbhCm: tree.dbh_cm, source: 'manual'
  })
  if (tree.species) snapshotFactor(tree.species, 'ground_truth_added')
  console.log(`[ground_truth] 手動回報 tree=${treeId} actual=${actualDbhCm}cm estimated=${tree.dbh_cm}cm factor=${correctionFactor}`)
  res.json({ id, correctionFactor, message: '實測值已記錄' })
})

// §30 POST /api/ground-truth/manual（人工皮尺實量；獨立於 path 0/A 自填）
app.post('/api/ground-truth/manual', (req, res) => {
  const { treeId, manualDbhCm, measuredBy, notes } = req.body || {}
  if (!treeId) return res.status(400).json({ error: 'treeId 必填' })
  const v = Number(manualDbhCm)
  if (!Number.isFinite(v) || v <= 0) return res.status(400).json({ error: 'manualDbhCm 必須為正數' })
  const tree = getDb().prepare('SELECT id FROM trees WHERE id = ?').get(treeId)
  if (!tree) return res.status(404).json({ error: '找不到該筆測量紀錄' })
  const r = upsertManualGroundTruth({ treeId, manualDbhCm: v, measuredBy: measuredBy || null, notes: notes || null })
  console.log(`[ground_truth] manual tree=${treeId} manual=${v}cm updated=${r.updated}`)
  res.json({ id: r.id, updated: r.updated, manualDbhCm: v })
})

// GET /api/ground-truth/stats
app.get('/api/ground-truth/stats', (req, res) => {
  res.json(getStats())
})

// GET /api/correction-factors
app.get('/api/correction-factors', (req, res) => {
  res.json(getAllFactors())
})

// GET /api/correction-factors/summary（必須在 :species 之前）
app.get('/api/correction-factors/summary', (req, res) => {
  const factors = getAllFactors()
  res.json(factors.map(f => ({
    ...f,
    thresholdReached: f.sampleCount >= 5,
  })))
})

// GET /api/correction-factors/:species
app.get('/api/correction-factors/:species', (req, res) => {
  res.json(getFactorBySpecies(decodeURIComponent(req.params.species)))
})

// GET /api/correction-factors/:species/history
app.get('/api/correction-factors/:species/history', (req, res) => {
  res.json(getFactorLogBySpecies(decodeURIComponent(req.params.species)))
})

// POST /api/evaluation/run（觸發評估，計算指標並存入 DB）
app.post('/api/evaluation/run', (req, res) => {
  const { speciesFilter, notes } = req.body || {}
  try {
    const result = runEvaluation({ speciesFilter, notes })
    res.json({
      runId: result.id,
      sampleCount: result.rawCount,
      metrics: result.metrics,
      maeCi: result.maeCi,
      mapeCi: result.mapeCi,
      dsrScore: result.checklist.score,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/evaluation/report（回傳 Markdown 報告）
app.get('/api/evaluation/report', (req, res) => {
  const speciesFilter = req.query.species || null
  try {
    const result = runEvaluation({ speciesFilter })
    res.type('text/markdown').send(result.report)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/evaluation/export.csv（原始資料下載）
app.get('/api/evaluation/export.csv', (req, res) => {
  const speciesFilter = req.query.species || null
  const csv = exportCsv(speciesFilter)
  if (!csv) return res.status(404).json({ error: '無 ground_truth 資料可匯出' })
  res.setHeader('Content-Disposition', 'attachment; filename="evaluation_data.csv"')
  res.type('text/csv').send(csv)
})

// GET /api/evaluation/dsr-checklist
app.get('/api/evaluation/dsr-checklist', (req, res) => {
  const latest = getLatestRun()
  const metrics = latest ? {
    n: latest.sample_count, mae: latest.mae, mape: latest.mape,
    rmse: latest.rmse, r2: latest.r2, bias: latest.bias,
  } : null
  res.json(buildDsrChecklist(metrics, getDb()))
})

// GET /api/trees（所有量測紀錄，含區塊鏈與校準資料）
app.get('/api/trees', (req, res) => {
  const rows = getDb().prepare(`
    SELECT
      t.id, t.video_hash, t.species, t.species_source,
      t.dbh_cm, t.volume_m3, t.carbon_kg, t.confidence,
      t.gps, t.focal_length_mm, t.sensor_width_mm,
      t.device_model, t.frame_quality, t.raw_result,
      t.reference_used, t.reference_type,
      t.original_dbh_cm, t.applied_correction_factor,
      t.video_filename, t.video_original_name, t.video_drive_url,
      t.path0_dbh_cm, t.pathA_dbh_cm, t.pathB_dbh_cm, t.pathB_dbh_cm_corrected,
      t.path0_volume_m3, t.pathA_volume_m3, t.pathB_volume_m3,
      t.path0_carbon_kg, t.pathA_carbon_kg, t.pathB_carbon_kg, t.winner_path,
      t.manual_tape_circ_cm, t.manual_tape_dbh_cm,
      t.manual_tape_frame_ts_sec, t.manual_tape_annotator, t.manual_tape_annotated_at,
      t.created_at,
      t.tx_hash   AS bc_tx_hash,
      t.tx_status AS bc_tx_status,
      t.created_at AS bc_created_at,
      gt.actual_dbh_cm AS ref_dbh_cm,
      gt.source        AS gt_source,
      gtm.manual_dbh_cm AS manual_dbh_cm,
      gtm.measured_by   AS manual_measured_by,
      gtm.measured_at   AS manual_measured_at,
      gtm.notes         AS manual_notes,
      CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS has_story,
      CASE WHEN env.id IS NOT NULL THEN 1 ELSE 0 END AS has_environment
    FROM trees t
    LEFT JOIN ground_truth gt ON gt.id = (
      SELECT id FROM ground_truth WHERE tree_id = t.id ORDER BY created_at DESC LIMIT 1
    )
    LEFT JOIN ground_truth gtm ON gtm.id = (
      SELECT id FROM ground_truth WHERE tree_id = t.id AND source = 'manual' LIMIT 1
    )
    LEFT JOIN stories s ON s.tree_id = t.id AND s.story_type = 'A'
    LEFT JOIN environmental_context env ON env.id = (
      SELECT id FROM environmental_context WHERE tree_id = t.id ORDER BY fetched_at DESC LIMIT 1
    )
    ORDER BY t.created_at ASC
  `).all()

  const total = rows.length
  res.json(rows.map((r, i) => {
    let raw = null
    try { raw = r.raw_result ? JSON.parse(r.raw_result) : null } catch (_) {}
    const meta = raw?.metadata || raw?.exif || null
    const med = raw?.median || null
    return {
      treeNo: `T${String(i + 1).padStart(3, '0')}`,
      id: r.id,
      videoHash: r.video_hash,
      species: r.species || '未辨識',
      speciesSource: r.species_source,
      dbhCm: r.dbh_cm,
      originalDbhCm: r.original_dbh_cm,
      appliedCorrectionFactor: r.applied_correction_factor,
      volumeM3: r.volume_m3,
      carbonKg: r.carbon_kg,
      confidence: r.confidence,
      gps: r.gps,
      focalLengthMm: r.focal_length_mm,
      sensorWidthMm: r.sensor_width_mm,
      deviceModel: r.device_model,
      frameQuality: r.frame_quality,
      referenceUsed: !!r.reference_used,
      referenceType: r.reference_type,
      videoFilename: r.video_filename || null,
      videoOriginalName: r.video_original_name || null,
      videoDriveUrl: r.video_drive_url || null,
      hasEvidenceFrame: fs.existsSync(path.join(EVIDENCE_DIR, `${r.id}.jpg`)),
      directMeasurementCm: med?.directMeasurementCm ?? 0,
      directMeasurementConfidence: med?.directMeasurementConfidence ?? null,
      measurementType: med?.measurementType ?? '',
      breastHeightVisible: med?.breastHeightVisible ?? null,
      createdAt: r.created_at,
      altitude: meta?.altitude ?? null,
      resolution: meta?.imageWidth && meta?.imageHeight
        ? `${meta.imageWidth} × ${meta.imageHeight}` : null,
      fps: meta?.videoFrameRate ?? null,
      blockchain: {
        txHash: r.bc_tx_hash || null,
        txStatus: r.bc_tx_status || 'none',
        createdAt: r.bc_created_at || null,
      },
      calibration: r.ref_dbh_cm != null ? {
        dbhCm: r.ref_dbh_cm,
        source: r.gt_source,
      } : null,
      // §30 人工皮尺實量（與 path 0/A 自填的 actual_dbh_cm 完全獨立）
      manualMeasurement: r.manual_dbh_cm != null ? {
        dbhCm: r.manual_dbh_cm,
        measuredBy: r.manual_measured_by,
        measuredAt: r.manual_measured_at,
        notes: r.manual_notes,
      } : null,
      // §31 影片皮尺批次標註（ground truth from manual circ + keyframe ts）
      manualTape: r.manual_tape_circ_cm != null ? {
        circCm: r.manual_tape_circ_cm,
        dbhCm: r.manual_tape_dbh_cm,
        frameTsSec: r.manual_tape_frame_ts_sec,
        annotator: r.manual_tape_annotator,
        annotatedAt: r.manual_tape_annotated_at,
      } : null,
      hasStory: !!r.has_story,
      hasEnvironment: !!r.has_environment,
      // §27 三路徑並列
      paths: {
        path0: r.path0_dbh_cm != null ? {
          dbhCm: r.path0_dbh_cm, volumeM3: r.path0_volume_m3, carbonKg: r.path0_carbon_kg, computed: true,
        } : { computed: false },
        pathA: r.pathA_dbh_cm != null ? {
          dbhCm: r.pathA_dbh_cm, volumeM3: r.pathA_volume_m3, carbonKg: r.pathA_carbon_kg, computed: true,
        } : { computed: false },
        pathB: r.pathB_dbh_cm != null ? {
          dbhCm: r.pathB_dbh_cm, dbhCmCorrected: r.pathB_dbh_cm_corrected,
          volumeM3: r.pathB_volume_m3, carbonKg: r.pathB_carbon_kg, computed: true,
        } : { computed: false },
      },
      winnerPath: r.winner_path || null,
      // §42 P4v2 fields
      p4v2: raw && raw.aggMethodFinal ? {
        engine: raw.engine,
        repeat: raw.repeat,
        medianRatio: raw.medianRatio,
        rawDbhCm: raw.rawDbhCm,
        calibratedDbhCm: raw.calibratedDbhCm,
        calibFactor: raw.calibFactor,
        aggMethodFinal: raw.aggMethodFinal,
        cv: raw.cv,
        measureTimestamps: raw.measureTimestamps || [],
        runs: (raw.runs || []).map(run => ({ videoTimestampSec: run.videoTimestampSec, ratio: run.ratio, confidence: run.confidence })),
        species: raw.species ? {
          agree: raw.species.agree,
          primary: raw.species.primary,
          source: raw.species.source,
          gemini: raw.species.gemini ? {
            species: raw.species.gemini.species,
            zhName: raw.species.gemini.zhName,
            confidence: raw.species.gemini.confidence,
            isDefaultFormula: raw.species.gemini.isDefaultFormula,
            carbonKg: raw.species.gemini.carbonKg,
            agbKg: raw.species.gemini.agbKg,
            co2eKg: raw.species.gemini.co2eKg,
          } : null,
          plantnet: raw.species.plantnet ? {
            species: raw.species.plantnet.species,
            zhName: raw.species.plantnet.zhName,
            confidence: raw.species.plantnet.confidence,
            isDefaultFormula: raw.species.plantnet.isDefaultFormula,
            carbonKg: raw.species.plantnet.carbonKg,
            agbKg: raw.species.plantnet.agbKg,
            co2eKg: raw.species.plantnet.co2eKg,
          } : null,
          leafTimestamps: raw.species.leafTimestamps || [],
        } : null,
        carbon: raw.carbon ? {
          primaryKg: raw.carbon.primaryKg,
          agbKg: raw.carbon.agbKg,
          co2eKg: raw.carbon.co2eKg,
          heightM: raw.carbon.heightM,
        } : null,
      } : null,
    }
  }))
})

// GET /api/trees/:id/frame-at?sec= (§42.F1: extract frame from video_cache at given timestamp)
app.get('/api/trees/:id/frame-at', (req, res) => {
  const { id } = req.params
  const sec = parseFloat(req.query.sec)
  if (isNaN(sec) || sec < 0 || sec > 3600) return res.status(400).json({ error: 'invalid sec' })
  const tree = getDb().prepare('SELECT video_original_name FROM trees WHERE id = ?').get(id)
  if (!tree) return res.status(404).json({ error: 'tree not found' })
  const vidName = tree.video_original_name
  if (!vidName) return res.status(404).json({ error: 'no video for this tree' })
  const vidPath = path.join(__dirname, 'video_cache', vidName)
  if (!fs.existsSync(vidPath)) return res.status(404).json({ error: 'video_cache miss: ' + vidName })
  const cacheDir = path.join(__dirname, 'tmp_frames', 'frame_at_cache')
  fs.mkdirSync(cacheDir, { recursive: true })
  const cacheFile = path.join(cacheDir, id + '_' + sec + '.jpg')
  if (fs.existsSync(cacheFile)) {
    res.setHeader('Content-Type', 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    return fs.createReadStream(cacheFile).pipe(res)
  }
  const { spawnSync } = require('child_process')
  const r = spawnSync('ffmpeg', ['-ss', String(sec), '-i', vidPath, '-vframes', '1', '-q:v', '2', '-y', cacheFile], { timeout: 30000 })
  if (r.status !== 0 || !fs.existsSync(cacheFile)) {
    return res.status(500).json({ error: 'ffmpeg failed', stderr: r.stderr?.toString() })
  }
  res.setHeader('Content-Type', 'image/jpeg')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  fs.createReadStream(cacheFile).pipe(res)
})

// 主要處理流程
async function processVideo(jobId, videoPath, originalName) {
  const framesDir = path.join('./tmp_frames', jobId)
  fs.mkdirSync(framesDir, { recursive: true })

  try {
    // 1. SHA-256 去重
    jobs[jobId].step = 'hashing'
    const videoHash = await hashFile(videoPath)
    const existing = findByVideoHash(videoHash)
    if (existing) {
      jobs[jobId] = { status: 'done', cached: true, result: { ...formatResult(existing), treeId: existing.id } }
      setImmediate(async () => {
        try {
          if (!getLatestByTree(existing.id, 'A')) {
            const storyA = await generateStoryA(existing.id)
            if (storyA) {
              insertStory({
                treeId: existing.id, storyType: 'A',
                markdown: storyA.markdown, summary: storyA.summary,
                weatherSnapshot: storyA.weather,
              })
              console.log(`[story] 方案A 故事補生成（cache hit）：tree=${existing.id}`)
              pushTreesJson()
            }
          }
        } catch (e) {
          console.warn('[story] cache hit 故事補生成失敗：', e.message)
        }
      })
      return
    }

    // 2. 元數據
    jobs[jobId].step = 'metadata'
    const metadata = await extractMetadata(videoPath)

    // 3. 擷取關鍵幀
    jobs[jobId].step = 'frames'
    const { cardFrames, allFrames, frameQuality } = await extractAndDetectCard(videoPath, framesDir)
    const regularFrames = selectRegularFrames(allFrames, 5)
    const frameBase64s = regularFrames.map(f => frameToBase64(f.path))
    console.log(`[frames] 2fps scan: ${allFrames.length} frames total, ${cardFrames.length} card frames (${cardFrames.filter(f=>f.isOrthogonal).length} orthogonal)`)

    // 4. AI 視覺分析（先跑，結果用於選葉片幀做樹種辨識）
    jobs[jobId].step = 'ai_analysis'
    const rawAnalysis = await analyzeTrunkWithRetry(frameBase64s, metadata)
    const median = getMedianResult(rawAnalysis.frames || [], metadata.imageWidth, metadata.imageHeight)

    // §35.4 Path A override: OpenCV-confirmed card frames → ratio-only Gemini
    if (cardFrames.length > 0) {
      try {
        const bestCard = cardFrames.slice(0, 3)
        const cardBase64s = bestCard.map(f => frameToBase64(f.path))
        const cardAnalysis = await analyzeTrunkPathAOnly(cardBase64s)
        const pathAResult = getPathAMedianRatio(cardAnalysis.frames || [])
        if (pathAResult) {
          console.log(`[pathA-opencv] ratio=${pathAResult.ratio.toFixed(3)} dbh=${pathAResult.dbhCm}cm conf=${pathAResult.confidence.toFixed(2)}`)
          median.referenceDetected = true
          median.referenceType = 'creditcard'
          median.referenceAtTrunk = true
          median.trunkToReferenceRatio = pathAResult.ratio
          median.referenceConfidence = pathAResult.confidence
          median.referenceOffTrunkDetected = false
        }
      } catch (e) {
        console.warn(`[pathA-opencv] failed: ${e.message}`)
      }
    }

    if (!median) throw new Error('無法識別樹幹，請重新拍攝')

    // 5. 樹種辨識：優先用 leafVisible 幀，無則用全部幀
    jobs[jobId].step = 'species'
    const leafFrames = median.leafFrameIndices.length > 0
      ? median.leafFrameIndices.map(i => frames[i]).filter(Boolean)
      : frames
    const leafFrameBase64s = median.leafFrameIndices.length > 0
      ? median.leafFrameIndices.map(i => frameBase64s[i]).filter(Boolean)
      : frameBase64s
    console.log(`[frames] 葉片幀 ${median.leafFrameIndices.length}/${frames.length} 幀，送 PlantNet: ${leafFrames.length} 幀`)

    const [plantnetResult, inatResult] = await Promise.all([
      plantnetIdentify(leafFrames, process.env.PLANTNET_API_KEY),
      inaturalistIdentify(leafFrames, process.env.INATURALIST_API_TOKEN),
    ])

    const MIN_SPECIES_CONFIDENCE = parseFloat(process.env.SPECIES_MIN_CONFIDENCE || '0.3')
    let species = null, speciesSource = 'unknown', speciesVotes = {}
    if (plantnetResult?.species && (plantnetResult.confidence ?? 0) >= MIN_SPECIES_CONFIDENCE)
      speciesVotes[plantnetResult.species] = { score: plantnetResult.confidence, source: 'plantnet' }
    if (inatResult?.species && (inatResult.confidence ?? 0) >= MIN_SPECIES_CONFIDENCE)
      speciesVotes[inatResult.species] = { score: inatResult.confidence, source: 'inaturalist' }

    const votes = Object.entries(speciesVotes)
    if (votes.length === 2) {
      const [a, b] = votes
      const sameGenus = a[0].split(' ')[0] === b[0].split(' ')[0]
      if (sameGenus) {
        const winner = a[1].score >= b[1].score ? a : b
        species = winner[0]; speciesSource = 'dual-' + winner[1].source
      } else {
        const winner = a[1].score >= b[1].score ? a : b
        species = winner[0]; speciesSource = winner[1].source + '-only'
      }
    } else if (votes.length === 1) {
      species = votes[0][0]; speciesSource = votes[0][1].source
    } else {
      const geminiSpecies = await identifySpeciesFallback(leafFrameBase64s, metadata.gps)
      species = geminiSpecies?.scientificName || null; speciesSource = 'gemini'
    }

    console.log(`[Species] ${species} (${speciesSource}) | Pl@ntNet:${plantnetResult?.species||'-'} iNat:${inatResult?.species||'-'}`)

    // 6. DBH 計算（含參照物路徑）
    const calc = calculate({
      species,
      pixelWidth: median.pixelWidth,
      estimatedDistanceM: median.estimatedDistanceM,
      distanceStdPct: median.distanceStdPct,
      validFrames: median.validFrames,
      metadata,
      frameQuality,
      referenceDetected: median.referenceDetected,
      referenceType: median.referenceType,
      trunkToReferenceRatio: median.trunkToReferenceRatio,
      referencePixelWidth: median.referencePixelWidth,
      referencePixelHeight: median.referencePixelHeight,
      referenceEstimatedWidthMm: median.referenceEstimatedWidthMm,
      referenceConfidence: median.referenceConfidence,
      directMeasurementCm: median.directMeasurementCm,
      measurementType: median.measurementType,
      referenceOffTrunkDetected: median.referenceOffTrunkDetected,
    })
    if (!calc) throw new Error(`DBH 計算失敗 [pixelWidth=${median.pixelWidth}, dist=${median.estimatedDistanceM}, focal=${metadata.focalLengthMm}, sensor=${metadata.sensorWidthMm}, imgW=${metadata.imageWidth}]`)

    // 6b. 套用修正因子（僅限無參照物的測量）
    let correctionApplied = false
    let originalDbhCm = null
    let appliedCorrectionFactor = null
    if (!calc.referenceUsed && species) {
      const cf = getFactorBySpecies(species)
      if (cf.applicable) {
        originalDbhCm = calc.dbhCm
        calc.dbhCm = Math.round(calc.dbhCm * cf.correctionFactor * 10) / 10
        correctionApplied = true
        appliedCorrectionFactor = cf.correctionFactor
        console.log(`[correction] ${species} factor=${cf.correctionFactor} ${originalDbhCm}→${calc.dbhCm}cm`)
      }
    }

    // 7. 存入 SQLite（含三路徑並列）
    jobs[jobId].step = 'saving'
    // Path B 修正後 DBH：若 winner 不是 Path B 且 Path B 有值，套 CF 取得修正版以利對照
    let pathBDbhCmCorrected = null
    if (calc.paths?.pathB && species) {
      try {
        const cfB = getFactorBySpecies(species)
        if (cfB.applicable) {
          pathBDbhCmCorrected = Math.round(calc.paths.pathB.dbhCm * cfB.correctionFactor * 10) / 10
        }
      } catch (_) {}
    }
    // 若 winner 是 Path B 且 CF 已套用，pathB_dbh_cm 仍存原始值，pathB_dbh_cm_corrected 存修正後
    if (calc.winner === 'pathB' && correctionApplied) {
      pathBDbhCmCorrected = calc.dbhCm  // 已修正
    }
    const treeId = insert({
      videoHash, species, speciesSource,
      dbhCm: calc.dbhCm, volumeM3: calc.volumeM3, carbonKg: calc.carbonKg,
      confidence: calc.confidence, gps: metadata.gps,
      focalLengthMm: metadata.focalLengthMm, sensorWidthMm: metadata.sensorWidthMm,
      deviceModel: metadata.model, frameQuality,
      referenceUsed: calc.referenceUsed ? 1 : 0,
      referenceType: calc.referenceType,
      originalDbhCm, appliedCorrectionFactor,
      videoFilename: null,
      videoOriginalName: originalName || null,
      rawResult: { median, calc, metadata, rawFrames: rawAnalysis.frames || [] },
      paths: calc.paths,
      winnerPath: calc.winner,
      pathBDbhCmCorrected,
      // §27.7.5 元數據完整封存
      createDate: metadata.createDateUnix,
      frameRate: metadata.frameRate,
      imageWidth: metadata.imageWidth,
      imageHeight: metadata.imageHeight,
      altitudeM: metadata.altitudeM,
      illuminanceLux: metadata.illuminanceLux,
      durationSec: metadata.durationSec,
      videoCodec: metadata.videoCodec,
      orientation: metadata.orientation,
      gpsImgDirectionDeg: metadata.gpsImgDirectionDeg,
      devicePressureHpa: metadata.devicePressureHpa,
      deviceAmbientTempC: metadata.deviceAmbientTempC,
    })
    const chainJobId = createBlockchainJob(treeId)

    // 7b. 產生測量依據幀縮圖（800×600）→ uploads/evidence/{treeId}.jpg
    try {
      const ev = pickEvidenceFrameIdx(median, rawAnalysis.frames || [])
      if (ev && frames[ev.frameIdx]) {
        const dest = path.join(EVIDENCE_DIR, `${treeId}.jpg`)
        await generateThumbnail(frames[ev.frameIdx], dest)
        console.log(`[evidence] tree=${treeId} frame=${ev.frameIdx} reason=${ev.reason}`)
      } else {
        console.log(`[evidence] tree=${treeId} 無可用依據幀（路徑 B 或資料不足）`)
      }
    } catch (evErr) {
      console.warn('[evidence] 產生失敗（不影響主流程）：', evErr.message)
    }

    // §29.3 per-frame 分析持久化：frame_idx 取 chosenPath 內 frame_N.jpg 的 N
    try {
      const enrichedFrames = (rawAnalysis.frames || []).map((f, arrayIdx) => {
        const chosenPath = frames[arrayIdx] || ''
        const m = chosenPath.match(/frame_(\d+)\.jpg$/)
        const realFrameIdx = m ? parseInt(m[1], 10) : arrayIdx
        return { ...f, frameIdx: realFrameIdx, frameQualityLabel: frameQuality }
      })
      const n = frameAnalyses.insertMany(treeId, enrichedFrames)
      // 同時記錄該樹對應 tmp_frames 子目錄（jobId）
      getDb().prepare('UPDATE trees SET tmp_frames_dir = ? WHERE id = ?').run(jobId, treeId)
      console.log(`[frame_analyses] tree=${treeId} rows=${n} dir=${jobId}`)
    } catch (faErr) {
      console.warn('[frame_analyses] 持久化失敗（不影響主流程）：', faErr.message)
    }

    // 路徑 0 或路徑 A 時自動寫入 ground_truth 並快照修正因子（per-path）
    if (calc.directMeasurementUsed || calc.referenceUsed) {
      const gtSource = calc.directMeasurementUsed ? 'direct_measurement' : 'reference'
      insertGroundTruth({ treeId, actualDbhCm: calc.dbhCm, estimatedDbhCm: calc.routeBDbhCm, source: gtSource })
      if (species) {
        // Path A CF：只有當 Path 0 是 ground truth、且 Path A 有值才有意義
        if (calc.directMeasurementUsed && calc.paths?.pathA) snapshotFactor(species, gtSource, 'A')
        // Path B CF：Path 0 或 Path A 為 ground truth 時都可訓練 Path B
        if (calc.paths?.pathB) snapshotFactor(species, gtSource, 'B')
      }
      console.log(`[ground_truth] ${gtSource} 自動寫入 tree=${treeId} actual=${calc.dbhCm}cm | pathA=${calc.paths?.pathA?.dbhCm ?? '-'} pathB=${calc.paths?.pathB?.dbhCm ?? '-'}`)
    }

    // 8. 上鏈
    jobs[jobId].step = 'blockchain'
    let txHash = null
    if (process.env.CONTRACT_ADDRESS && (process.env.SIGNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY)) {
      try {
        txHash = await recordMeasurement({
          gps: metadata.gps, species, dbhCm: calc.dbhCm,
          volumeM3: calc.volumeM3, carbonKg: calc.carbonKg, videoHash,
          treeId, originalDbhCm, appliedCorrectionFactor,
        })
        updateStatus(chainJobId, txHash, 'confirmed')
      } catch (chainErr) {
        incrementRetry(chainJobId)
        console.warn('上鏈失敗，將於重試：', chainErr.message)
      }
    }

    const result = {
      treeId, species, speciesSource, ...calc, txHash, frameQuality, gps: metadata.gps,
      correctionApplied, originalDbhCm, appliedCorrectionFactor,
      speciesDetail: {
        plantnet: plantnetResult ? { species: plantnetResult.species, confidence: plantnetResult.confidence } : null,
        inaturalist: inatResult ? { species: inatResult.species, confidence: inatResult.confidence } : null,
      }
    }
    jobs[jobId] = { status: 'done', result }

    // 9. 時空聚類 + 非同步故事生成（不阻塞回應）
    setImmediate(async () => {
      // 9a. 環境快照寫入（必須先於故事生成，因為故事會讀取 environmental_context）
      try {
        let envLat = null, envLng = null
        if (metadata.gps && typeof metadata.gps === 'string') {
          const m = metadata.gps.match(/^(-?[0-9.]+),\s*(-?[0-9.]+)$/)
          if (m) { envLat = parseFloat(m[1]); envLng = parseFloat(m[2]) }
        }
        const envUnixTs = metadata.createDateUnix || Math.floor(Date.now() / 1000)
        await persistEnvironmentContext(treeId, envLat, envLng, envUnixTs, metadata.altitudeM ?? null)
      } catch (envErr) {
        console.warn('[envctx] 環境快照失敗（不影響主流程）：', envErr.message)
      }

      try {
        const { eventId, isNew } = assignToEvent(treeId)
        if (eventId) {
          result.eventId = eventId

          // 方案 A 故事（單棵樹）
          const storyA = await generateStoryA(treeId)
          if (storyA) {
            insertStory({
              treeId,
              eventId,
              storyType: 'A',
              markdown: storyA.markdown,
              summary: storyA.summary,
              weatherSnapshot: storyA.weather,
            })
            console.log(`[story] 方案A 故事生成完成：tree=${treeId}`)
          }

          // 方案 C 故事（Event 形成時，或每次更新後重生成）
          const storyC = await generateStoryC(eventId)
          if (storyC) {
            insertStory({ eventId, storyType: 'C', markdown: storyC })
            setStoryC(eventId, storyC)
            console.log(`[story] 方案C 故事${isNew ? '首次' : '更新'}生成：event=${eventId}`)
          }
        }
      } catch (storyErr) {
        console.warn('[story] 故事生成失敗（不影響主流程）：', storyErr.message)
      }
      // GitHub 同步（故事生成後再推，確保 storyMarkdown 已寫入）
      pushTreesJson()
    })

  } finally {
    // 處理完即刪原始影片（VM 磁碟有限；source-of-truth 由使用者保存在 Google Drive）
    try { fs.unlinkSync(videoPath) } catch (_) {}
    // 暫存幀保留不刪，路徑：tmp_frames/[jobId]/
    console.log(`[frames] 關鍵幀位置：${path.resolve(framesDir)}`)
  }
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    fs.createReadStream(filePath)
      .on('data', d => hash.update(d))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject)
  })
}

function formatResult(row) {
  const job = getJobByTreeId(row.id)
  return {
    species: row.species, speciesSource: row.species_source,
    dbhCm: row.dbh_cm, volumeM3: row.volume_m3, carbonKg: row.carbon_kg,
    confidence: row.confidence, gps: row.gps,
    txHash: job?.tx_hash || null,
    originalDbhCm: row.original_dbh_cm || null,
    appliedCorrectionFactor: row.applied_correction_factor || null,
  }
}

// GET /api/trees/:id/video（串流原始影片，支援 HTTP Range 拖動時間軸）
app.get('/api/trees/:id/video', (req, res) => {
  const row = getDb().prepare('SELECT video_filename FROM trees WHERE id = ?').get(req.params.id)
  if (!row || !row.video_filename) return res.status(404).json({ error: '找不到該影片' })

  // 防 path traversal：只允許單純檔名（無斜線、無 ..）
  const filename = row.video_filename
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return res.status(400).json({ error: '無效檔名' })
  }
  const filePath = path.join(UPLOAD_DIR, filename)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '影片檔已不存在' })

  const stat = fs.statSync(filePath)
  const range = req.headers.range
  const contentType = filename.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 'video/quicktime'

  if (range) {
    const m = /^bytes=(\d+)-(\d*)$/.exec(range)
    if (!m) return res.status(416).end()
    const start = parseInt(m[1], 10)
    const end = m[2] ? parseInt(m[2], 10) : stat.size - 1
    if (start >= stat.size || end >= stat.size) return res.status(416).end()
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': contentType,
    })
    fs.createReadStream(filePath, { start, end }).pipe(res)
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    })
    fs.createReadStream(filePath).pipe(res)
  }
})

// GET /api/trees/:id/environment（環境快照：天氣 + UV + 日照 + 太陽位置 + 物候）
app.get('/api/trees/:id/environment', (req, res) => {
  const treeId = req.params.id
  if (!/^[a-f0-9-]{36}$/i.test(treeId)) return res.status(400).json({ error: '無效 ID' })
  try {
    const { getByTreeId: getEnvByTreeId } = require('./db/environmentalContext')
    const env = getEnvByTreeId(treeId)
    if (!env) return res.status(404).json({ error: '此樹尚無環境快照' })
    res.json(env)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/trees/:id/path-frames（§29.4：三路徑各自的依據幀 + 全部 frame_analyses）
app.get('/api/trees/:id/path-frames', (req, res) => {
  const treeId = req.params.id
  if (!/^[a-f0-9-]{36}$/i.test(treeId)) return res.status(400).json({ error: '無效 ID' })

  const tree = getDb().prepare(`
    SELECT id, raw_result, tmp_frames_dir,
           path0_dbh_cm, pathA_dbh_cm, pathB_dbh_cm, winner_path,
           manual_tape_dbh_cm, manual_tape_circ_cm,
           manual_tape_frame_ts_sec, duration_sec
    FROM trees WHERE id = ?
  `).get(treeId)
  if (!tree) return res.status(404).json({ error: '找不到該樹木紀錄' })

  let raw = null
  try { raw = tree.raw_result ? JSON.parse(tree.raw_result) : null } catch (_) {}
  const median = raw?.median || null

  const rows = frameAnalyses.getByTreeId(treeId)

  // 路徑 0 證據：優先用人工皮尺值（manual_tape_*），從 tmp_frames 13 幀中
  // 挑離 manual_tape_frame_ts_sec 最近的那張（均勻取樣 0~12）。
  // 若無人工值，fallback 原本的 AI OCR 篩選邏輯。
  function pickPath0() {
    if (tree.manual_tape_dbh_cm > 0) {
      const ts = tree.manual_tape_frame_ts_sec
      const dur = tree.duration_sec
      let frameIdx = 6
      if (ts != null && dur > 0) {
        frameIdx = Math.round((ts / dur) * 12)
        if (frameIdx < 0) frameIdx = 0
        if (frameIdx > 12) frameIdx = 12
      }
      const isCirc = tree.manual_tape_circ_cm > 0
      return {
        frameIdx,
        reason: 'manual_tape',
        value: isCirc ? tree.manual_tape_circ_cm : tree.manual_tape_dbh_cm,
        measurementType: isCirc ? 'circumference' : 'diameter',
        confidence: 1.0,
        manualTapeDbhCm: tree.manual_tape_dbh_cm,
        manualTapeTsSec: ts,
      }
    }
    if (!median || !(median.directMeasurementCm > 0)) return null
    const target = median.directMeasurementCm
    const cands = rows.filter(r =>
      (r.direct_measurement_cm || 0) > 0 &&
      (r.direct_confidence || 0) >= 0.5 &&
      Math.abs(r.direct_measurement_cm - target) / target <= 0.10
    ).sort((a, b) => (b.direct_confidence || 0) - (a.direct_confidence || 0))
    if (cands.length === 0) return null
    const c = cands[0]
    return {
      frameIdx: c.frame_idx,
      reason: 'tape',
      value: c.direct_measurement_cm,
      measurementType: c.measurement_type || '',
      confidence: c.direct_confidence,
    }
  }
  function pickPathA() {
    if (!median?.referenceDetected || !median?.referenceAtTrunk) return null
    const cands = rows.filter(r =>
      r.reference_detected === 1 &&
      r.reference_at_trunk !== 0 &&
      (r.reference_confidence || 0) >= 0.4
    ).sort((a, b) => (b.reference_confidence || 0) - (a.reference_confidence || 0))
    if (cands.length === 0) return null
    const c = cands[0]
    return {
      frameIdx: c.frame_idx,
      reason: 'reference',
      referenceType: c.reference_type || '',
      confidence: c.reference_confidence,
    }
  }

  res.json({
    treeId,
    tmpFramesDir: tree.tmp_frames_dir || null,
    winnerPath: tree.winner_path || null,
    paths: {
      path0: tree.path0_dbh_cm != null ? { dbhCm: tree.path0_dbh_cm, evidence: pickPath0() } : null,
      pathA: tree.pathA_dbh_cm != null ? { dbhCm: tree.pathA_dbh_cm, evidence: pickPathA() } : null,
      pathB: tree.pathB_dbh_cm != null ? {
        dbhCm: tree.pathB_dbh_cm,
        evidence: null,
        note: '路徑 B（視覺估算）使用全部 5 幀中位數，無單一依據幀',
      } : null,
    },
    frames: rows.map(r => ({
      frameIdx: r.frame_idx,
      directMeasurementCm: r.direct_measurement_cm,
      directConfidence: r.direct_confidence,
      measurementType: r.measurement_type,
      referenceDetected: r.reference_detected === 1,
      referenceAtTrunk: r.reference_at_trunk === 1,
      referenceType: r.reference_type,
      referenceConfidence: r.reference_confidence,
      trunkWidthFraction: r.trunk_width_fraction,
      referenceWidthFraction: r.reference_width_fraction,
      breastHeightVisible: r.breast_height_visible === 1,
      leafVisible: r.leaf_visible === 1,
      frameQualityLabel: r.frame_quality_label,
    })),
  })
})

// GET /api/trees/:id/frames/:idx（§29.5：原始關鍵幀 JPG，從 tmp_frames_dir 讀）
app.get('/api/trees/:id/frames/:idx', (req, res) => {
  const treeId = req.params.id
  const idx = parseInt(req.params.idx, 10)
  if (!/^[a-f0-9-]{36}$/i.test(treeId)) return res.status(400).json({ error: '無效 ID' })
  if (!Number.isInteger(idx) || idx < 0 || idx > 99) return res.status(400).json({ error: '無效 idx' })

  const row = getDb().prepare('SELECT tmp_frames_dir FROM trees WHERE id = ?').get(treeId)
  if (!row || !row.tmp_frames_dir) return res.status(404).json({ error: '尚無關鍵幀目錄' })

  const dir = row.tmp_frames_dir
  if (dir.includes('/') || dir.includes('\\') || dir.includes('..')) {
    return res.status(400).json({ error: '無效目錄名' })
  }
  const filePath = path.join(process.cwd(), 'tmp_frames', dir, `frame_${idx}.jpg`)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: `找不到 frame_${idx}.jpg` })

  res.type('image/jpeg')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  fs.createReadStream(filePath).pipe(res)
})

// GET /api/trees/:id/evidence-frame（測量依據幀縮圖）
app.get('/api/trees/:id/evidence-frame', (req, res) => {
  const id = req.params.id
  if (!/^[a-f0-9-]{36}$/i.test(id)) return res.status(400).json({ error: '無效 ID' })
  const filePath = path.join(EVIDENCE_DIR, `${id}.jpg`)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '尚無依據幀' })
  res.type('image/jpeg')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  fs.createReadStream(filePath).pipe(res)
})

// GET /api/trees/:id/story（單棵樹 Markdown 故事）
app.get('/api/trees/:id/story', async (req, res) => {
  const treeId = req.params.id
  const tree = getDb().prepare('SELECT id, species FROM trees WHERE id = ?').get(treeId)
  if (!tree) return res.status(404).json({ error: '找不到該樹木紀錄' })

  // 先查快取
  let story = getLatestByTree(treeId, 'A')

  // 無快取則即時生成
  if (!story) {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: '故事生成需設定 GEMINI_API_KEY' })
    }
    try {
      const storyA = await generateStoryA(treeId)
      if (!storyA) return res.status(500).json({ error: '故事生成失敗' })
      const storyId = insertStory({
        treeId,
        storyType: 'A',
        markdown: storyA.markdown,
        summary: storyA.summary,
        weatherSnapshot: storyA.weather,
      })
      story = { id: storyId, markdown: storyA.markdown, created_at: Math.floor(Date.now() / 1000) }
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  const format = req.query.format
  if (format === 'json') {
    return res.json({ treeId, markdown: story.markdown, generatedAt: story.created_at })
  }
  res.type('text/markdown; charset=utf-8').send(story.markdown)
})

// GET /api/events/:id（Event JSON）
app.get('/api/events/:id', (req, res) => {
  const event = getEventById(req.params.id)
  if (!event) return res.status(404).json({ error: '找不到 Event' })
  const trees = getTreesInEvent(event.id)
  const comments = getDb().prepare(
    `SELECT id, nickname, content, created_at FROM event_comments WHERE event_id = ? ORDER BY created_at ASC`
  ).all(event.id)

  res.json({
    id: event.id,
    name: event.name,
    date: event.date,
    locationGps: event.location_gps,
    treeCount: event.tree_count,
    totalCarbonKg: Math.round((event.total_carbon_kg || 0) * 10) / 10,
    participantCount: event.participant_count,
    storyC: event.story_c || null,
    trees: trees.map(t => ({
      id: t.id,
      species: t.species,
      dbhCm: t.dbh_cm,
      carbonKg: t.carbon_kg,
      gps: t.gps,
      createdAt: t.created_at,
    })),
    comments,
  })
})

// POST /api/events/:id/comments（participantToken 驗證）
app.post('/api/events/:id/comments', (req, res) => {
  const eventId = req.params.id
  const { participantToken, nickname, content } = req.body || {}
  if (!participantToken || !content) {
    return res.status(400).json({ error: 'participantToken 和 content 必填' })
  }
  if (content.length > 500) {
    return res.status(400).json({ error: '留言不得超過 500 字' })
  }

  // 驗證 token：確認該 event 下有對應 treeId（token = treeId）
  const event = getEventById(eventId)
  if (!event) return res.status(404).json({ error: '找不到 Event' })

  const validTree = getDb().prepare(
    'SELECT id FROM trees WHERE event_id = ? AND id = ?'
  ).get(eventId, participantToken)
  if (!validTree) return res.status(403).json({ error: 'participantToken 無效' })

  const { randomUUID } = require('crypto')
  const commentId = randomUUID()
  getDb().prepare(`
    INSERT INTO event_comments (id, event_id, participant_token, nickname, content)
    VALUES (?, ?, ?, ?, ?)
  `).run(commentId, eventId, participantToken, nickname || '匿名', content)

  res.json({ id: commentId, message: '留言已新增' })
})

// 定時重試 pending 上鏈（每 5 分鐘）
setInterval(async () => {
  if (!process.env.CONTRACT_ADDRESS) return
  const pending = getPending()
  for (const row of pending) {
    try {
      const txHash = await recordMeasurement({
        gps: row.gps, species: row.species,
        dbhCm: row.dbh_cm, volumeM3: row.volume_m3,
        carbonKg: row.carbon_kg, videoHash: row.video_hash,
      })
      updateStatus(row.jobId, txHash, 'confirmed')
      console.log(`✅ 補上鏈成功：tree=${row.treeId} → ${txHash}`)
    } catch (e) {
      incrementRetry(row.jobId)
      console.warn(`⏳ 補上鏈失敗，下次重試：tree=${row.treeId}`)
    }
  }
}, 5 * 60 * 1000)

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: '檔案超過 500MB 上限' })
  res.status(400).json({ error: err.message })
})

app.listen(PORT, () => console.log(`🌲 Forest Carbon Measurement 啟動：http://localhost:${PORT}`))
