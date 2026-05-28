// recover_pathA_orthogonal.js  §34.5
// 對 |pathA_err%| > 10% 的 25 棵 + pathA IS NULL 重跑 Gemini
// 使用改良版 prompt，新增 referenceOrthogonalToCamera / referenceFullyVisible 過濾
// 已在 ±10% 以內的 6 棵跳過不重跑

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai')
const { getDb } = require('./src/db/init')
const { getFormulaByScientificName } = require('./src/data/formulaDb')

const CREDITCARD_WIDTH_MM = 85.6
const TMP_FRAMES_ROOT = path.join(process.cwd(), 'tmp_frames')

const CARD_SCHEMA_V2 = {
  type: SchemaType.OBJECT,
  properties: {
    frames: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          trunkDetected:               { type: SchemaType.BOOLEAN },
          trunkWidthFraction:          { type: SchemaType.NUMBER  },
          creditCardDetected:          { type: SchemaType.BOOLEAN },
          creditCardAtTrunk:           { type: SchemaType.BOOLEAN },
          trunkToCardRatio:            { type: SchemaType.NUMBER  },
          cardWidthFraction:           { type: SchemaType.NUMBER  },
          detectionConfidence:         { type: SchemaType.NUMBER  },
          referenceOrthogonalToCamera: { type: SchemaType.BOOLEAN },
          referenceFullyVisible:       { type: SchemaType.BOOLEAN },
        },
        required: [
          'trunkDetected', 'trunkWidthFraction',
          'creditCardDetected', 'creditCardAtTrunk',
          'trunkToCardRatio', 'cardWidthFraction', 'detectionConfidence',
          'referenceOrthogonalToCamera', 'referenceFullyVisible',
        ],
      },
    },
  },
  required: ['frames'],
}

const CARD_PROMPT_V2 = `你是林業測量 AI。圖片為手機拍攝的樹木關鍵幀。

目標：找出畫面中的**信用卡／金融卡**（標準尺寸 85.6mm × 54mm），以其作為比例尺計算樹幹胸高直徑。

對每張圖片回傳：

1. trunkDetected：是否能看到樹幹
2. trunkWidthFraction：胸高（約 1.3m 高）樹幹寬佔畫面寬比例（0.0–1.0）
3. creditCardDetected：畫面中是否有信用卡或金融卡（塑膠卡片，長寬比約 1.6:1）
   - 注意：不要把卷尺、皮尺、直尺當成參照物
   - 卡片傾斜仍算偵測到
4. creditCardAtTrunk：信用卡是否靠著樹幹（接觸或貼在樹幹上）
5. trunkToCardRatio：胸高樹幹寬是信用卡長邊（85.6mm）的幾倍，未偵測到填 0
6. cardWidthFraction：信用卡長邊佔畫面寬比例，未偵測到填 0
7. detectionConfidence：偵測信心度 0.0–1.0（清晰可見 0.7+；部分遮蔽 0.4–0.7；不確定 < 0.4）

8. referenceOrthogonalToCamera：信用卡是否正面朝向相機（正交於拍攝視線）？
   - true  = 卡片正面可見，長邊大致水平，傾斜角 < 30°，可測量到完整寬度
   - false = 卡片側立、後仰或明顯斜向相機（傾斜 > 30°），畫面呈壓縮變形

9. referenceFullyVisible：信用卡是否完整出現在畫面中（四個角都可見，無遮擋）？
   - true  = 整張卡片在畫面內，邊緣無裁切、無手指或物體遮住主要部分
   - false = 卡片邊緣超出畫面、被裁掉、或有重大遮蔽

重要：僅辨識信用卡，不辨識其他參照物。`

function median(arr) {
  if (arr.length === 0) return null
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

function buildPathResult(dbhCm, species) {
  const formula = getFormulaByScientificName(species)
  const heightM  = formula.hdA * Math.pow(dbhCm, formula.hdB)
  const volumeM3 = formula.volA * Math.pow(dbhCm, formula.volB) * Math.pow(heightM, formula.volC)
  const carbonKg = volumeM3 * formula.woodDensity * formula.bef * 0.5
  return {
    dbhCm:    Math.round(dbhCm * 10) / 10,
    volumeM3: Math.round(volumeM3 * 10000) / 10000,
    carbonKg: Math.round(carbonKg * 10) / 10,
  }
}

async function analyzeFramesV2(frameBase64s) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json', responseSchema: CARD_SCHEMA_V2 },
  })
  const parts = [{ text: CARD_PROMPT_V2 }]
  frameBase64s.forEach(b64 => parts.push({ inlineData: { mimeType: 'image/jpeg', data: b64 } }))
  const result = await model.generateContent(parts)
  return JSON.parse(result.response.text()).frames || []
}

function rotateFramesCW(framesDir, frameFiles) {
  const rotatedDir = framesDir + '_rot'
  fs.mkdirSync(rotatedDir, { recursive: true })
  const rotated = []
  for (const f of frameFiles) {
    const src = path.join(framesDir, f)
    const dst = path.join(rotatedDir, f)
    if (!fs.existsSync(dst)) execSync(`ffmpeg -y -i "${src}" -vf transpose=1 "${dst}" 2>/dev/null`)
    rotated.push(dst)
  }
  return rotated
}

async function recoverTree(tree) {
  const framesDir = path.join(TMP_FRAMES_ROOT, tree.tmp_frames_dir)
  if (!fs.existsSync(framesDir)) {
    console.log(`  warning: tmp_frames missing: ${tree.tmp_frames_dir}`)
    return null
  }

  let frameFiles = []
  for (let i = 0; i <= 12; i++) {
    const name = `frame_${i}.jpg`
    if (fs.existsSync(path.join(framesDir, name))) frameFiles.push(name)
  }
  if (frameFiles.length === 0) { console.log(`  warning: no frames`); return null }
  console.log(`  ${frameFiles.length} frames`)

  let workingFiles = frameFiles.map(f => path.join(framesDir, f))
  if (tree.id.startsWith('db0c5e0f')) {
    console.log(`  rotating 90 CW`)
    workingFiles = rotateFramesCW(framesDir, frameFiles)
  }

  const BATCH = 5
  let allRaw = []
  for (let i = 0; i < workingFiles.length; i += BATCH) {
    const batch = workingFiles.slice(i, i + BATCH)
    const base64s = batch.map(fp => fs.readFileSync(fp).toString('base64'))
    console.log(`  Gemini batch ${Math.floor(i / BATCH) + 1} (${batch.length} frames)`)
    const results = await analyzeFramesV2(base64s)
    allRaw = allRaw.concat(results.map((r, j) => ({ ...r, frameIdx: i + j })))
  }

  const toDbh = (f) => {
    let ratio = f.trunkToCardRatio || 0
    if (!(ratio > 0) && f.trunkWidthFraction > 0 && f.cardWidthFraction > 0) {
      ratio = f.trunkWidthFraction / f.cardWidthFraction
    }
    const dbhCm = ratio > 0 ? Math.round(ratio * CREDITCARD_WIDTH_MM / 10 * 10) / 10 : null
    return { ...f, ratio, dbhCm: (dbhCm != null && dbhCm >= 1 && dbhCm <= 200) ? dbhCm : null }
  }

  // Strict: card + at trunk + orthogonal + fully visible
  const strict = allRaw
    .filter(f =>
      f.creditCardDetected &&
      f.creditCardAtTrunk &&
      f.referenceOrthogonalToCamera !== false &&
      f.referenceFullyVisible !== false
    )
    .map(toDbh)
    .filter(f => f.dbhCm != null)

  console.log(`  orthogonal+visible frames: ${strict.length}`)

  if (strict.length > 0) {
    const dbhCm = median(strict.map(f => f.dbhCm))
    console.log(`  median DBH=${dbhCm}cm (${strict.length} frames)`)
    return { dbhCm, frames: allRaw }
  }

  // Relax: drop fully-visible requirement
  const relaxed = allRaw
    .filter(f =>
      f.creditCardDetected &&
      f.creditCardAtTrunk &&
      f.referenceOrthogonalToCamera !== false
    )
    .map(toDbh)
    .filter(f => f.dbhCm != null)

  if (relaxed.length > 0) {
    console.log(`  relaxed (ignoring fullyVisible): ${relaxed.length} frames`)
    const dbhCm = median(relaxed.map(f => f.dbhCm))
    console.log(`  median DBH=${dbhCm}cm`)
    return { dbhCm, frames: allRaw }
  }

  console.log(`  no valid orthogonal frames`)
  return { dbhCm: null, frames: allRaw }
}

async function main() {
  const db = getDb()

  const trees = db.prepare(`
    SELECT id, species, video_original_name, path0_dbh_cm, pathA_dbh_cm,
           tmp_frames_dir, image_width,
           CASE WHEN path0_dbh_cm IS NOT NULL AND pathA_dbh_cm IS NOT NULL
                THEN ABS(pathA_dbh_cm - path0_dbh_cm) / path0_dbh_cm * 100
                ELSE NULL END AS err_pct
    FROM trees
    WHERE tmp_frames_dir IS NOT NULL
      AND (
        pathA_dbh_cm IS NULL
        OR (path0_dbh_cm IS NOT NULL AND pathA_dbh_cm IS NOT NULL
            AND ABS(pathA_dbh_cm - path0_dbh_cm) / path0_dbh_cm > 0.10)
      )
    ORDER BY err_pct DESC NULLS LAST, created_at
  `).all()

  const skipped = db.prepare(`
    SELECT COUNT(*) as n FROM trees
    WHERE path0_dbh_cm IS NOT NULL AND pathA_dbh_cm IS NOT NULL
      AND ABS(pathA_dbh_cm - path0_dbh_cm) / path0_dbh_cm <= 0.10
  `).get()

  console.log(`target trees: ${trees.length}`)
  console.log(`skipped (<=10%): ${skipped.n}\n`)

  let improved = 0, failed = 0

  for (const tree of trees) {
    const errStr = tree.err_pct != null ? `err=${tree.err_pct.toFixed(1)}%` : 'pathA=NULL'
    console.log(`\n--- ${tree.id.slice(0, 8)} ${tree.video_original_name} (${errStr}, p0=${tree.path0_dbh_cm}cm, pA=${tree.pathA_dbh_cm}cm)`)

    if (!tree.tmp_frames_dir) { console.log('  no tmp_frames_dir'); failed++; continue }

    let result
    try {
      result = await recoverTree(tree)
    } catch (err) {
      console.log(`  error: ${err.message}`)
      failed++
      continue
    }

    if (!result || !result.dbhCm) { failed++; continue }

    const pr = buildPathResult(result.dbhCm, tree.species)
    const newErr = tree.path0_dbh_cm
      ? (Math.abs(pr.dbhCm - tree.path0_dbh_cm) / tree.path0_dbh_cm * 100).toFixed(1)
      : null

    db.prepare(
      'UPDATE trees SET pathA_dbh_cm=?, pathA_volume_m3=?, pathA_carbon_kg=? WHERE id=?'
    ).run(pr.dbhCm, pr.volumeM3, pr.carbonKg, tree.id)

    // Back-fill frame_analyses orthogonal columns from this run
    const updateFA = db.prepare(
      'UPDATE frame_analyses SET reference_orthogonal=?, reference_fully_visible=? WHERE tree_id=? AND frame_idx=?'
    )
    db.transaction(() => {
      for (const f of (result.frames || [])) {
        const orth = f.referenceOrthogonalToCamera == null ? null : (f.referenceOrthogonalToCamera ? 1 : 0)
        const vis  = f.referenceFullyVisible == null ? null : (f.referenceFullyVisible ? 1 : 0)
        if (orth !== null || vis !== null) updateFA.run(orth, vis, tree.id, f.frameIdx)
      }
    })()

    const changeStr = tree.pathA_dbh_cm != null
      ? `${tree.pathA_dbh_cm}->${pr.dbhCm}cm  err: ${tree.err_pct?.toFixed(1)}%->${newErr}%`
      : `NULL->${pr.dbhCm}cm  newErr=${newErr}%`
    console.log(`  UPDATED: ${changeStr}  V=${pr.volumeM3} C=${pr.carbonKg}`)
    improved++
  }

  console.log(`\n== done ==  improved=${improved}  failed=${failed}  total=${trees.length}`)

  // Final error distribution
  const paired = db.prepare(`
    SELECT path0_dbh_cm, pathA_dbh_cm, video_original_name,
           ABS(pathA_dbh_cm - path0_dbh_cm) / path0_dbh_cm * 100 AS err_pct
    FROM trees WHERE path0_dbh_cm IS NOT NULL AND pathA_dbh_cm IS NOT NULL
    ORDER BY err_pct
  `).all()
  const w10 = paired.filter(r => r.err_pct <= 10).length
  const w25 = paired.filter(r => r.err_pct <= 25).length
  console.log(`\n== final pathA error (${paired.length} paired) ==`)
  console.log(`  <=10%: ${w10}  <=25%: ${w25}  >25%: ${paired.length - w25}`)
  paired.forEach(r => {
    const flag = r.err_pct <= 10 ? 'OK ' : r.err_pct <= 25 ? 'MED' : 'BAD'
    console.log(`  [${flag}] p0=${r.path0_dbh_cm}  pA=${r.pathA_dbh_cm}  err=${r.err_pct.toFixed(1)}%  ${r.video_original_name}`)
  })
}

main().catch(console.error)
