require('dotenv').config()
const express = require('express')
const multer = require('multer')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')

const { extractMetadata } = require('./services/metadataService')
const { extractFrames, selectBestFrames, frameToBase64 } = require('./services/frameService')
const { identifySpecies: plantnetIdentify } = require('./services/plantnetService')
const { identifySpecies: inaturalistIdentify } = require('./services/inaturalistService')
const { analyzeTrunkWithRetry, getMedianResult, identifySpeciesFallback } = require('./services/geminiService')
const { calculate } = require('./services/calculationService')
const { findByVideoHash, insert } = require('./db/trees')
const { insert: insertGroundTruth, getByTreeId, getStats } = require('./db/groundTruth')
const { getBySpecies: getFactorLogBySpecies } = require('./db/correctionFactorLog')
const { create: createBlockchainJob, getPending, updateStatus, incrementRetry, getByTreeId: getJobByTreeId } = require('./db/blockchainJobs')
const { getFactorBySpecies, getAllFactors, snapshotFactor } = require('./services/correctionFactorService')
const { recordMeasurement } = require('./services/blockchainService')
const { runEvaluation, getLatestRun, exportCsv, buildDsrChecklist } = require('./services/evaluationService')
const { getDb } = require('./db/init')

const app = express()
const PORT = process.env.PORT || 3000
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

// 確保目錄存在
fs.mkdirSync(UPLOAD_DIR, { recursive: true })
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
  processVideo(jobId, req.file.path).catch(err => {
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
      t.created_at,
      t.tx_hash   AS bc_tx_hash,
      t.tx_status AS bc_tx_status,
      t.created_at AS bc_created_at,
      gt.actual_dbh_cm AS ref_dbh_cm,
      gt.source        AS gt_source
    FROM trees t
    LEFT JOIN ground_truth gt ON gt.id = (
      SELECT id FROM ground_truth WHERE tree_id = t.id ORDER BY created_at DESC LIMIT 1
    )
    ORDER BY t.created_at ASC
  `).all()

  const total = rows.length
  res.json(rows.map((r, i) => {
    let raw = null
    try { raw = r.raw_result ? JSON.parse(r.raw_result) : null } catch (_) {}
    const meta = raw?.metadata || raw?.exif || null
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
    }
  }))
})

// 主要處理流程
async function processVideo(jobId, videoPath) {
  const framesDir = path.join('./tmp_frames', jobId)
  fs.mkdirSync(framesDir, { recursive: true })

  try {
    // 1. SHA-256 去重
    jobs[jobId].step = 'hashing'
    const videoHash = await hashFile(videoPath)
    const existing = findByVideoHash(videoHash)
    if (existing) {
      jobs[jobId] = { status: 'done', cached: true, result: formatResult(existing) }
      return
    }

    // 2. 元數據
    jobs[jobId].step = 'metadata'
    const metadata = await extractMetadata(videoPath)

    // 3. 擷取關鍵幀
    jobs[jobId].step = 'frames'
    const candidates = await extractFrames(videoPath, framesDir)
    const { frames, frameQuality } = await selectBestFrames(candidates)
    const frameBase64s = frames.map(frameToBase64)

    // 4. 樹種辨識（Pl@ntNet + iNaturalist 同時執行）
    jobs[jobId].step = 'species'
    const [plantnetResult, inatResult] = await Promise.all([
      plantnetIdentify(frames, process.env.PLANTNET_API_KEY),
      inaturalistIdentify(frames, process.env.INATURALIST_API_TOKEN),
    ])

    const MIN_SPECIES_CONFIDENCE = parseFloat(process.env.SPECIES_MIN_CONFIDENCE || '0.3')
    let species = null, speciesSource = 'unknown', speciesVotes = {}
    if (plantnetResult?.species && (plantnetResult.confidence ?? 0) >= MIN_SPECIES_CONFIDENCE)
      speciesVotes[plantnetResult.species] = { score: plantnetResult.confidence, source: 'plantnet' }
    if (inatResult?.species && (inatResult.confidence ?? 0) >= MIN_SPECIES_CONFIDENCE)
      speciesVotes[inatResult.species] = { score: inatResult.confidence, source: 'inaturalist' }

    // 兩者相符（同屬）→ 取信心較高者；否則各自保留
    const votes = Object.entries(speciesVotes)
    if (votes.length === 2) {
      const [a, b] = votes
      const sameGenus = a[0].split(' ')[0] === b[0].split(' ')[0]
      if (sameGenus) {
        // 同屬，取信心高的那個，來源標為 dual
        const winner = a[1].score >= b[1].score ? a : b
        species = winner[0]; speciesSource = 'dual-' + winner[1].source
      } else {
        // 不同屬，各自信心比較
        const winner = a[1].score >= b[1].score ? a : b
        species = winner[0]; speciesSource = winner[1].source + '-only'
      }
    } else if (votes.length === 1) {
      species = votes[0][0]; speciesSource = votes[0][1].source
    } else {
      // 兩者都失敗，用 Gemini
      const geminiSpecies = await identifySpeciesFallback(frameBase64s, metadata.gps)
      species = geminiSpecies?.scientificName || null; speciesSource = 'gemini'
    }

    console.log(`[Species] ${species} (${speciesSource}) | Pl@ntNet:${plantnetResult?.species||'-'} iNat:${inatResult?.species||'-'}`)

    // 5. AI 視覺分析
    jobs[jobId].step = 'ai_analysis'
    const rawAnalysis = await analyzeTrunkWithRetry(frameBase64s, metadata)
    const median = getMedianResult(rawAnalysis.frames || [], metadata.imageWidth, metadata.imageHeight)

    if (!median) throw new Error('無法識別樹幹，請重新拍攝')

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

    // 7. 存入 SQLite
    jobs[jobId].step = 'saving'
    const treeId = insert({
      videoHash, species, speciesSource,
      dbhCm: calc.dbhCm, volumeM3: calc.volumeM3, carbonKg: calc.carbonKg,
      confidence: calc.confidence, gps: metadata.gps,
      focalLengthMm: metadata.focalLengthMm, sensorWidthMm: metadata.sensorWidthMm,
      deviceModel: metadata.model, frameQuality,
      referenceUsed: calc.referenceUsed ? 1 : 0,
      referenceType: calc.referenceType,
      originalDbhCm, appliedCorrectionFactor,
      rawResult: { median, calc, metadata },
    })
    const chainJobId = createBlockchainJob(treeId)

    // 路徑 0 或路徑 A 時自動寫入 ground_truth 並快照修正因子
    if (calc.directMeasurementUsed || calc.referenceUsed) {
      const gtSource = calc.directMeasurementUsed ? 'direct_measurement' : 'reference'
      insertGroundTruth({ treeId, actualDbhCm: calc.dbhCm, estimatedDbhCm: calc.routeBDbhCm, source: gtSource })
      if (species) snapshotFactor(species, gtSource)
      console.log(`[ground_truth] ${gtSource} 自動寫入 tree=${treeId} actual=${calc.dbhCm}cm estimated=${calc.routeBDbhCm}cm`)
    }

    // 8. 上鏈
    jobs[jobId].step = 'blockchain'
    let txHash = null
    if (process.env.CONTRACT_ADDRESS && (process.env.SIGNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY)) {
      try {
        txHash = await recordMeasurement({
          gps: metadata.gps, species, dbhCm: calc.dbhCm,
          volumeM3: calc.volumeM3, carbonKg: calc.carbonKg, videoHash,
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

  } finally {
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
