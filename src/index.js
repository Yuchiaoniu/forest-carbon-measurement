require('dotenv').config()
const express = require('express')
const multer = require('multer')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')

const { extractMetadata } = require('./services/metadataService')
const { extractFrames, selectBestFrames, frameToBase64 } = require('./services/frameService')
const { identifySpecies } = require('./services/plantnetService')
const { analyzeTrunkWithRetry, getMedianResult, identifySpeciesFallback } = require('./services/geminiService')
const { calculate } = require('./services/calculationService')
const { findByVideoHash, insert, updateTxHash, getPendingTx } = require('./db/trees')
const { recordMeasurement } = require('./services/blockchainService')
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

app.use(express.static('public'))

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

    // 4. 樹種辨識
    jobs[jobId].step = 'species'
    let species = null, speciesSource = 'unknown'
    const plantnetResult = await identifySpecies(frames, process.env.PLANTNET_API_KEY)
    if (plantnetResult && plantnetResult.confidence >= 0.80) {
      species = plantnetResult.species
      speciesSource = 'plantnet'
    } else {
      const geminiSpecies = await identifySpeciesFallback(frameBase64s, metadata.gps)
      species = geminiSpecies?.scientificName || null
      speciesSource = 'gemini'
    }

    // 5. AI 視覺分析
    jobs[jobId].step = 'ai_analysis'
    const rawAnalysis = await analyzeTrunkWithRetry(frameBase64s, metadata)
    const median = getMedianResult(rawAnalysis.frames || [])

    if (!median) throw new Error('無法識別樹幹，請重新拍攝')

    // 6. DBH 計算
    const calc = calculate({
      species,
      pixelWidth: median.pixelWidth,
      estimatedDistanceM: median.estimatedDistanceM,
      distanceStdPct: median.distanceStdPct,
      validFrames: median.validFrames,
      metadata,
      frameQuality,
    })
    if (!calc) throw new Error('DBH 計算失敗')

    // 7. 存入 SQLite
    jobs[jobId].step = 'saving'
    const treeId = insert({
      videoHash, species, speciesSource,
      dbhCm: calc.dbhCm, volumeM3: calc.volumeM3, carbonKg: calc.carbonKg,
      confidence: calc.confidence, gps: metadata.gps,
      focalLengthMm: metadata.focalLengthMm, sensorWidthMm: metadata.sensorWidthMm,
      deviceModel: metadata.model, frameQuality, txStatus: 'pending',
      rawResult: { median, calc, metadata },
    })

    // 8. 上鏈
    jobs[jobId].step = 'blockchain'
    let txHash = null
    if (process.env.CONTRACT_ADDRESS && process.env.SIGNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY) {
      try {
        txHash = await recordMeasurement({
          gps: metadata.gps, species, dbhCm: calc.dbhCm,
          volumeM3: calc.volumeM3, carbonKg: calc.carbonKg, videoHash,
        })
        updateTxHash(treeId, txHash, 'confirmed')
      } catch (chainErr) {
        // 上鏈失敗，保持 pending，定時重試會處理
        console.warn('上鏈失敗，將於重試：', chainErr.message)
      }
    }

    const result = { species, speciesSource, ...calc, txHash, frameQuality, gps: metadata.gps }
    jobs[jobId] = { status: 'done', result }

  } finally {
    // 清理暫存幀
    fs.rmSync(framesDir, { recursive: true, force: true })
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
  return {
    species: row.species, speciesSource: row.species_source,
    dbhCm: row.dbh_cm, volumeM3: row.volume_m3, carbonKg: row.carbon_kg,
    confidence: row.confidence, txHash: row.tx_hash, gps: row.gps,
  }
}

// 定時重試 pending 上鏈（每 5 分鐘）
setInterval(async () => {
  if (!process.env.CONTRACT_ADDRESS) return
  const pending = getPendingTx()
  for (const row of pending) {
    try {
      const raw = JSON.parse(row.raw_result || '{}')
      const txHash = await recordMeasurement({
        gps: row.gps, species: row.species,
        dbhCm: row.dbh_cm, volumeM3: row.volume_m3,
        carbonKg: row.carbon_kg, videoHash: row.video_hash,
      })
      updateTxHash(row.id, txHash, 'confirmed')
      console.log(`✅ 補上鏈成功：${row.id} → ${txHash}`)
    } catch (e) {
      console.warn(`⏳ 補上鏈失敗，下次重試：${row.id}`)
    }
  }
}, 5 * 60 * 1000)

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: '檔案超過 500MB 上限' })
  res.status(400).json({ error: err.message })
})

app.listen(PORT, () => console.log(`🌲 Forest Carbon Measurement 啟動：http://localhost:${PORT}`))
