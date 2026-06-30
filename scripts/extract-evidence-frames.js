// 遷移腳本：為既有的樹木紀錄補產測量依據幀縮圖
// 流程：對每筆有 video_filename 與 raw_result.rawFrames 的紀錄
//   1. 從 uploads/{video_filename} 重新跑 extractFrames + selectBestFrames
//      （兩階段都是確定性的：時間戳由片長決定、Laplacian 分數對同一張圖一致）
//   2. 用 raw_result.median + raw_result.rawFrames 呼叫 pickEvidenceFrameIdx
//   3. 將對應的 frame 縮圖至 uploads/evidence/{treeId}.jpg
//
// 用法：node scripts/extract-evidence-frames.js [--dry-run] [--force]

const path = require('path')
const fs = require('fs')

process.chdir(path.join(__dirname, '..'))

const { getDb } = require('../src/db/init')
const { extractFrames, selectBestFrames } = require('../src/services/frameService')
const { pickEvidenceFrameIdx, generateThumbnail } = require('../src/services/evidenceFrameService')

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const EVIDENCE_DIR = path.join(UPLOAD_DIR, 'evidence')
const TMP_DIR = './tmp_frames_migration'

const args = new Set(process.argv.slice(2))
const DRY_RUN = args.has('--dry-run')
const FORCE = args.has('--force')

async function main() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  fs.mkdirSync(TMP_DIR, { recursive: true })

  const rows = getDb().prepare(`
    SELECT id, video_filename, raw_result
    FROM trees
    WHERE video_filename IS NOT NULL AND raw_result IS NOT NULL
    ORDER BY created_at ASC
  `).all()

  console.log(`掃描到 ${rows.length} 筆有影片的紀錄${DRY_RUN ? '（DRY RUN）' : ''}`)

  let ok = 0, skipped = 0, noPath = 0, noFile = 0, failed = 0

  for (const r of rows) {
    const destPath = path.join(EVIDENCE_DIR, `${r.id}.jpg`)
    if (!FORCE && fs.existsSync(destPath)) {
      skipped++
      console.log(`  [skip] ${r.id.slice(0, 8)} 已有依據幀（--force 可覆寫）`)
      continue
    }

    let parsed
    try { parsed = JSON.parse(r.raw_result) } catch (_) { parsed = null }
    const median = parsed?.median
    const rawFrames = parsed?.rawFrames
    if (!median || !Array.isArray(rawFrames) || rawFrames.length === 0) {
      noPath++
      console.log(`  [no-data] ${r.id.slice(0, 8)} 無 median 或 rawFrames`)
      continue
    }

    const ev = pickEvidenceFrameIdx(median, rawFrames)
    if (!ev) {
      noPath++
      console.log(`  [no-path] ${r.id.slice(0, 8)} 路徑 B 或資料不足，無依據幀`)
      continue
    }

    const videoPath = path.join(UPLOAD_DIR, r.video_filename)
    if (!fs.existsSync(videoPath)) {
      noFile++
      console.log(`  [no-file] ${r.id.slice(0, 8)} 影片不存在：${r.video_filename}`)
      continue
    }

    if (DRY_RUN) {
      console.log(`  [dry] ${r.id.slice(0, 8)} → frame=${ev.frameIdx} reason=${ev.reason}`)
      ok++
      continue
    }

    try {
      const jobDir = path.join(TMP_DIR, r.id)
      fs.mkdirSync(jobDir, { recursive: true })
      const candidates = await extractFrames(videoPath, jobDir)
      const { frames } = await selectBestFrames(candidates)
      const srcFrame = frames[ev.frameIdx]
      if (!srcFrame || !fs.existsSync(srcFrame)) {
        throw new Error(`frameIdx=${ev.frameIdx} 不在重抽結果中（共 ${frames.length} 幀）`)
      }
      await generateThumbnail(srcFrame, destPath)
      ok++
      console.log(`  [ok] ${r.id.slice(0, 8)} → frame=${ev.frameIdx} reason=${ev.reason} ${ev.reason === 'tape' ? `(${ev.value}cm)` : `(${ev.referenceType})`}`)
    } catch (e) {
      failed++
      console.warn(`  [fail] ${r.id.slice(0, 8)}: ${e.message}`)
    }
  }

  console.log('')
  console.log(`完成：OK=${ok}  Skipped=${skipped}  NoEvidencePath=${noPath}  NoVideoFile=${noFile}  Failed=${failed}`)

  if (!DRY_RUN) {
    try { fs.rmSync(TMP_DIR, { recursive: true, force: true }) } catch (_) {}
  }
}

main().catch(e => { console.error(e); process.exit(1) })
