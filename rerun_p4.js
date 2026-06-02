// rerun_p4.js v2 — 拆開設計（B/C 決策後）
// 量測：原始純量測 prompt（只回數字＋videoTimestampSec），N=10；關鍵幀＝每次量測的 videoTimestampSec（真實、不造假）
// 樹種：獨立一次呼叫（Gemini）＋ Pl@ntNet（用 leafTimestamps 抓樹冠幀）；兩種都存、不分勝負；兩種碳各算
// 影片快取到持久目錄、不刪
// Usage: node rerun_p4.js --file-id <fid> --img IMG_xxxx --tape <cm> [--repeat 10] [--dry]
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai')
const { GoogleAIFileManager, FileState } = require('@google/generative-ai/server')

const { getDb } = require('./src/db/init')
const { extractMetadata } = require('./src/services/metadataService')
const { identifySpecies: plantnetIdentify } = require('./src/services/plantnetService')
const { getFormulaByScientificName } = require('./src/data/formulaDb')
const { insert: insertTree } = require('./src/db/trees')
const { create: createBlockchainJob, updateStatus } = require('./src/db/blockchainJobs')
const { recordMeasurement } = require('./src/services/blockchainService')

const GDOWN = '/home/yuchi/.local/bin/gdown'
const VIDS = path.join(__dirname, 'video_cache')        // 持久快取，不刪
const LEAFDIR = path.join(__dirname, 'species_frames')  // 判樹種的幀（持久，供 dashboard）
const CARD_W_CM = 8.56
const API_KEY = process.env.GEMINI_API_KEY
const MIN_SPECIES_CONF = parseFloat(process.env.SPECIES_MIN_CONFIDENCE || '0.3')

// 原始純量測 prompt（證明過、73% 那版）
const MEASURE_PROMPT = `這是一支樹幹測量影片。畫面中有一張信用卡（國際標準長邊 85.6mm）靠在樹幹上 — **這就是胸高 1.3 公尺的測量位置**。

請看完整支影片，找出**卡片最清晰、最正對鏡頭**的時刻。然後在那個時刻：

1. 量信用卡長邊像素寬 → cardPixelWidth
2. 量「卡片所在的同一個高度」上樹幹的左右邊緣像素寬 → trunkPixelWidth
   ⚠ 不要看樹幹上方或下方、不要看分叉處、不要看細枝
   ⚠ 只看跟卡片同高度（左右水平延伸）的樹幹寬度
   ⚠ 樹幹「主體」邊緣，不含樹皮花紋、附生植物、背景樹、陰影
3. 計算 trunkToCardRatio = trunkPixelWidth / cardPixelWidth
4. videoTimestampSec：你做判斷的影片時間點（第幾秒）— 這欄位用來稽核你看的位置對不對
5. confidence 0.0–1.0

只回傳一組數字。無法判斷時所有數字填 0。`
const MEASURE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    cardPixelWidth: { type: SchemaType.NUMBER },
    trunkPixelWidth: { type: SchemaType.NUMBER },
    trunkToCardRatio: { type: SchemaType.NUMBER },
    videoTimestampSec: { type: SchemaType.NUMBER },
    confidence: { type: SchemaType.NUMBER },
  },
  required: ['cardPixelWidth', 'trunkPixelWidth', 'trunkToCardRatio', 'videoTimestampSec', 'confidence'],
}

// 樹種獨立呼叫
const SPECIES_PROMPT = `請看這支樹木影片判斷樹種。回傳：
- speciesScientificName：樹種拉丁學名（無法判斷填空字串）
- speciesConfidence：信心 0.0–1.0
- leafTimestamps：2–4 個樹冠或葉子最清楚、最適合辨識樹種的時間點（格式 MM:SS）`
const SPECIES_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    speciesScientificName: { type: SchemaType.STRING },
    speciesConfidence: { type: SchemaType.NUMBER },
    leafTimestamps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['speciesScientificName', 'speciesConfidence', 'leafTimestamps'],
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const mean = a => a.reduce((s, x) => s + x, 0) / a.length
const coeffVar = arr => { const v = arr.filter(x => x != null && x > 0); if (v.length < 2) return null; const m = mean(v); const s = Math.sqrt(v.reduce((p, x) => p + (x - m) ** 2, 0) / v.length); return m > 0 ? s / m * 100 : null }
const trimmedMean = arr => { const v = arr.filter(x => x != null && x > 0).sort((a, b) => a - b); if (!v.length) return null; const t = v.length > 2 ? v.slice(1, -1) : v; return mean(t) }
const mmssToSec = s => { const m = String(s || '').match(/^(\d{1,2}):(\d{2})$/); return m ? (+m[1]) * 60 + (+m[2]) : (Number(s) >= 0 ? Number(s) : null) }

function download(fileId, dest) {
  const r = spawnSync(GDOWN, [fileId, '-O', dest, '-q'], { encoding: 'utf8', timeout: 600000 })
  if (r.status !== 0 || !fs.existsSync(dest) || fs.statSync(dest).size < 1024) throw new Error(`gdown failed: ${(r.stderr || '').slice(0, 200)}`)
}
function extractFrameAt(video, sec, outPath) {
  spawnSync('ffmpeg', ['-y', '-ss', String(sec), '-i', video, '-frames:v', '1', '-vf', 'scale=1024:-1', outPath], { encoding: 'utf8', timeout: 120000 })
  return fs.existsSync(outPath) && fs.statSync(outPath).size > 1024 ? outPath : null
}
async function uploadAndWait(fm, localPath, name) {
  let { file } = await fm.uploadFile(localPath, { mimeType: 'video/quicktime', displayName: name })
  while (file.state === FileState.PROCESSING) { await sleep(3000); file = await fm.getFile(file.name) }
  if (file.state !== FileState.ACTIVE) throw new Error(`upload state=${file.state}`)
  return file
}
function carbonOf(species, dbhCm) {
  const f = getFormulaByScientificName(species)
  const H = f.hdA * Math.pow(dbhCm, f.hdB)
  const V = f.volA * Math.pow(dbhCm, f.volB) * Math.pow(H, f.volC)
  const carbonKg = V * f.woodDensity * f.bef * 0.5
  return { zhName: f.zhName, isDefault: !!f.isDefault, heightM: H, volumeM3: V, agbKg: carbonKg * 2, carbonKg, co2eKg: carbonKg * 3.67 }
}
function findExistingByDrive(fileId) { return getDb().prepare("SELECT id FROM trees WHERE video_drive_url LIKE ?").get(`%${fileId}%`) }

async function main() {
  const argv = process.argv.slice(2)
  const get = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null }
  const fileId = get('file-id'), img = get('img'), tape = parseFloat(get('tape'))
  const repeat = parseInt(get('repeat') || '10', 10)
  const dry = argv.includes('--dry')
  if (!fileId || !img) { console.error('need --file-id --img'); process.exit(1) }

  fs.mkdirSync(VIDS, { recursive: true })
  const localPath = path.join(VIDS, `${img}.mov`)
  if (!(fs.existsSync(localPath) && fs.statSync(localPath).size > 1024 * 1024)) { console.log(`[dl] ${fileId}`); download(fileId, localPath) }
  else console.log('[dl] cache hit')

  console.log('[meta] extracting…')
  const metadata = await extractMetadata(localPath).catch(e => { console.warn('meta fail', e.message); return {} })

  const fm = new GoogleAIFileManager(API_KEY)
  const genAI = new GoogleGenerativeAI(API_KEY)
  const file = await uploadAndWait(fm, localPath, img)

  // === 量測：N 次純量測呼叫 ===
  const measureModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: 'application/json', responseSchema: MEASURE_SCHEMA } })
  console.log(`[measure] N=${repeat}…`)
  const settled = await Promise.allSettled(Array.from({ length: repeat }, () => measureModel.generateContent([{ fileData: { mimeType: file.mimeType, fileUri: file.uri } }, { text: MEASURE_PROMPT }]).then(r => JSON.parse(r.response.text()))))
  const runs = settled.map(s => s.status === 'fulfilled' ? s.value : null).filter(Boolean)
  if (!runs.length) { try { await fm.deleteFile(file.name) } catch {}; throw new Error('all measure runs failed') }
  const ratios = runs.map(r => r.trunkToCardRatio)
  const aggRatio = trimmedMean(ratios)
  const cv = coeffVar(ratios)
  if (aggRatio == null) throw new Error('no valid ratio')
  const dbhCm = Math.round(aggRatio * CARD_W_CM * 10) / 10  // 原始值（暫不套校準，跑完 31 再定）
  const err = tape ? Math.abs(dbhCm - tape) / tape * 100 : null

  // === 樹種：獨立一次呼叫 ===
  const spModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: 'application/json', responseSchema: SPECIES_SCHEMA } })
  let spRes = null
  try { spRes = JSON.parse((await spModel.generateContent([{ fileData: { mimeType: file.mimeType, fileUri: file.uri } }, { text: SPECIES_PROMPT }])).response.text()) } catch (e) { console.warn('[species] gemini fail', e.message) }
  try { await fm.deleteFile(file.name) } catch {}

  const geminiSpecies = (spRes?.speciesScientificName || '').trim() || null
  const geminiConf = spRes?.speciesConfidence ?? 0
  const leafTs = (spRes?.leafTimestamps || []).map(mmssToSec).filter(s => s != null && s >= 0).slice(0, 4)

  // 抓判樹種的幀（持久存，供 dashboard 顯示）→ Pl@ntNet
  const treeLeafDir = path.join(LEAFDIR, img)
  fs.mkdirSync(treeLeafDir, { recursive: true })
  let secs = leafTs.length ? leafTs : [0.15, 0.4, 0.65, 0.9].map(f => Math.round((metadata.durationSec || 60) * f))
  const leafFrames = []
  secs.slice(0, 4).forEach((s, i) => { const p = extractFrameAt(localPath, s, path.join(treeLeafDir, `leaf_${i}.jpg`)); if (p) leafFrames.push(p) })
  const plantnet = leafFrames.length ? await plantnetIdentify(leafFrames, process.env.PLANTNET_API_KEY).catch(() => null) : null
  const plantnetSpecies = (plantnet?.species && (plantnet.confidence ?? 0) >= MIN_SPECIES_CONF) ? plantnet.species : null
  const plantnetConf = plantnet?.confidence ?? 0

  // 兩種樹種、兩種碳（不分勝負）
  const gC = geminiSpecies ? carbonOf(geminiSpecies, dbhCm) : null
  const pC = plantnetSpecies ? carbonOf(plantnetSpecies, dbhCm) : null
  const agree = geminiSpecies && plantnetSpecies && gC && pC && gC.zhName === pC.zhName
  // 主值（trees 單欄位用）：優先 Gemini（看整支影片），無則 Pl@ntNet
  const primarySpecies = geminiSpecies || plantnetSpecies
  const primaryC = gC || pC
  const speciesSource = agree ? 'agree' : (geminiSpecies && plantnetSpecies ? 'gemini+plantnet' : (geminiSpecies ? 'gemini' : (plantnetSpecies ? 'plantnet' : 'unknown')))

  console.log(`\n=== ${img} ===`)
  console.log(`ratios: [${ratios.map(r => r.toFixed(2)).join(', ')}] cv=${cv?.toFixed(1)}%  DBH=${dbhCm}cm tape=${tape} err=${err?.toFixed(1)}%`)
  console.log(`量測時刻(videoTimestampSec): [${runs.map(r => r.videoTimestampSec).join(', ')}]`)
  console.log(`樹種: gemini=${geminiSpecies}(${geminiConf.toFixed(2)},${gC?.zhName}) plantnet=${plantnetSpecies}(${plantnetConf.toFixed(2)},${pC?.zhName}) agree=${agree}`)
  console.log(`碳: gemini=${gC?.carbonKg?.toFixed(1)}kg / plantnet=${pC?.carbonKg?.toFixed(1)}kg  leafTs=${JSON.stringify(secs.slice(0,4))}`)

  if (dry) { console.log('\n[dry] 不寫 DB、不上鏈'); return }

  const rawResult = {
    engine: 'P4v2-measure-pure-N10', repeat, ratios, aggMethod: 'trimmed-mean-drop1', aggRatio, cv, dbhCm, err,
    runs: runs.map(r => ({ ratio: r.trunkToCardRatio, cardPixelWidth: r.cardPixelWidth, trunkPixelWidth: r.trunkPixelWidth, videoTimestampSec: r.videoTimestampSec, confidence: r.confidence })),
    measureTimestamps: runs.map(r => r.videoTimestampSec),  // 關鍵幀＝真實量測時刻
    manualTapeCm: tape, driveFileId: fileId,
    species: {
      agree, primary: primarySpecies, source: speciesSource,
      gemini: geminiSpecies ? { species: geminiSpecies, confidence: geminiConf, zhName: gC.zhName, isDefaultFormula: gC.isDefault, agbKg: gC.agbKg, carbonKg: gC.carbonKg, co2eKg: gC.co2eKg } : null,
      plantnet: plantnetSpecies ? { species: plantnetSpecies, confidence: plantnetConf, zhName: pC.zhName, isDefaultFormula: pC.isDefault, agbKg: pC.agbKg, carbonKg: pC.carbonKg, co2eKg: pC.co2eKg } : null,
      leafTimestamps: secs.slice(0, 4),
    },
    carbon: { primaryKg: primaryC?.carbonKg ?? null, agbKg: primaryC?.agbKg ?? null, co2eKg: primaryC?.co2eKg ?? null, heightM: primaryC?.heightM ?? null, volumeM3: primaryC?.volumeM3 ?? null },
  }

  const driveUrl = `https://drive.google.com/file/d/${fileId}/view`
  const existing = findExistingByDrive(fileId)
  let treeId
  if (existing) {
    treeId = existing.id
    getDb().prepare(`UPDATE trees SET species=?, species_source=?, dbh_cm=?, volume_m3=?, carbon_kg=?, confidence=?, raw_result=?,
      original_dbh_cm=NULL, applied_correction_factor=NULL, winner_path='p4v2',
      path0_dbh_cm=NULL, pathA_dbh_cm=NULL, pathB_dbh_cm=NULL, video_drive_url=? WHERE id=?`)
      .run(primarySpecies, speciesSource, dbhCm, primaryC?.volumeM3 ?? null, primaryC?.carbonKg ?? null, mean(runs.map(r => r.confidence || 0)), JSON.stringify(rawResult), driveUrl, treeId)
    console.log(`[db] UPDATE ${treeId}（保留故事/EXIF）`)
  } else {
    treeId = insertTree({
      videoHash: `p4_${fileId}`, species: primarySpecies, speciesSource,
      dbhCm, volumeM3: primaryC?.volumeM3 ?? null, carbonKg: primaryC?.carbonKg ?? null, confidence: mean(runs.map(r => r.confidence || 0)),
      gps: metadata.gps || null, focalLengthMm: metadata.focalLengthMm, sensorWidthMm: metadata.sensorWidthMm, deviceModel: metadata.model,
      frameQuality: 'p4v2', rawResult, paths: null, winnerPath: 'p4v2', videoOriginalName: `${img}.mov`,
      createDate: metadata.createDateUnix, frameRate: metadata.frameRate, imageWidth: metadata.imageWidth, imageHeight: metadata.imageHeight,
      altitudeM: metadata.altitudeM, illuminanceLux: metadata.illuminanceLux, durationSec: metadata.durationSec, videoCodec: metadata.videoCodec,
      orientation: metadata.orientation, gpsImgDirectionDeg: metadata.gpsImgDirectionDeg, devicePressureHpa: metadata.devicePressureHpa, deviceAmbientTempC: metadata.deviceAmbientTempC,
    })
    getDb().prepare('UPDATE trees SET video_drive_url=? WHERE id=?').run(driveUrl, treeId)
    console.log(`[db] INSERT ${treeId}`)
  }

  const jobId = createBlockchainJob(treeId)
  if (process.env.CONTRACT_ADDRESS && (process.env.SIGNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY)) {
    try {
      const txHash = await recordMeasurement({ gps: metadata.gps || '', species: primarySpecies, dbhCm, volumeM3: primaryC?.volumeM3 ?? 0, carbonKg: primaryC?.carbonKg ?? 0, videoHash: `p4_${fileId}`, treeId, originalDbhCm: null, appliedCorrectionFactor: null })
      updateStatus(jobId, txHash, 'confirmed')
      console.log(`[chain] tx=${txHash}`)
    } catch (e) { console.warn('[chain] fail', e.message) }
  }
  console.log(`[done] ${img} → tree ${treeId}, isNew=${!existing}`)
}
main().catch(e => { console.error('FATAL:', e); process.exit(1) })
