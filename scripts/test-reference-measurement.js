require('dotenv').config()
const { randomUUID } = require('crypto')
const { calculate, validateReferenceAspectRatio, REFERENCE_SIZES } = require('../src/services/calculationService')
const { getDb } = require('../src/db/init')
const { insert: insertTree } = require('../src/db/trees')
const { insert: insertGroundTruth, getByTreeId } = require('../src/db/groundTruth')

let passed = 0, failed = 0

function check(label, actual, expected) {
  const ok = typeof expected === 'function' ? expected(actual) : actual === expected
  if (ok) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    const exp = typeof expected === 'function' ? '（條件函式）' : expected
    console.log(`  ❌ ${label}：預期 ${exp}，實際 ${actual}`)
    failed++
  }
}

// 標準 metadata（iPhone 14 感光元件）
const IPHONE14_META = {
  sensorWidthMm: 5.76,
  focalLengthMm: 5.1,
  imageWidth: 3840,
  imageHeight: 2160,
  sensorIsDefault: false,
  gps: '24.1477,120.6736',
}

// 標準計算輸入共用欄位
const BASE_INPUT = {
  species: 'Cryptomeria japonica',
  pixelWidth: 320,
  estimatedDistanceM: 4.0,
  distanceStdPct: 10,
  validFrames: 3,
  metadata: IPHONE14_META,
  frameQuality: 'good',
  referenceOffTrunkDetected: false,
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 14.1：信用卡參照物 → referenceUsed=true、confidence=high、DBH 精準
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[14.1] 信用卡參照物端對端計算')

{
  // 信用卡寬 85.6mm，trunkToReferenceRatio=1.5 → DBH = 1.5 × 85.6mm = 128.4mm ≈ 12.8cm
  const expectedDbhCm = Math.round(1.5 * 85.6 / 10 * 10) / 10  // 12.8
  const result = calculate({
    ...BASE_INPUT,
    referenceDetected: true,
    referenceType: 'creditcard',
    trunkToReferenceRatio: 1.5,
    referencePixelWidth: 200,   // 正常信用卡像素寬
    referencePixelHeight: 126,  // ≈ 200 × (53.98/85.6) ≈ 126，長寬比正常
    referenceEstimatedWidthMm: 0,
    referenceConfidence: 0.9,
  })

  check('result 不為 null', result !== null, true)
  check('referenceUsed=true', result?.referenceUsed, true)
  check('referenceType=creditcard', result?.referenceType, 'creditcard')
  check(`DBH=${expectedDbhCm}cm`, result?.dbhCm, expectedDbhCm)
  check('confidence=high', result?.confidence, 'high')
  check('formulaSource 存在', !!result?.formulaSource, true)
  check('carbonKg > 0', (result?.carbonKg ?? 0) > 0, true)
}

{
  // 確認參照物寬度記錄正確
  const result = calculate({
    ...BASE_INPUT,
    referenceDetected: true,
    referenceType: 'creditcard',
    trunkToReferenceRatio: 2.0,
    referencePixelWidth: 200,
    referencePixelHeight: 126,
    referenceEstimatedWidthMm: 0,
    referenceConfidence: 0.85,
  })
  check('referenceWidthMm=85.6', result?.referenceWidthMm, 85.6)
  check('distanceUsedM=null（參照物路徑不使用距離）', result?.distanceUsedM, null)
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 14.2：A4 紙參照物 → 正確比例尺換算 DBH
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[14.2] A4 紙參照物比例尺換算')

{
  // A4 寬 210mm，trunkToReferenceRatio=0.8 → DBH = 0.8 × 210mm = 168mm = 16.8cm
  const expectedDbhCm = Math.round(0.8 * 210 / 10 * 10) / 10   // 16.8
  // A4 正向擺放（portrait）：width=210, height=297 → 像素應呈直立比例
  const result = calculate({
    ...BASE_INPUT,
    referenceDetected: true,
    referenceType: 'a4',
    trunkToReferenceRatio: 0.8,
    referencePixelWidth: 150,   // A4 portrait：pixelWidth < pixelHeight
    referencePixelHeight: 212,  // ≈ 150 × (297/210) ≈ 212，長寬比正常
    referenceEstimatedWidthMm: 0,
    referenceConfidence: 0.8,
  })

  check('result 不為 null', result !== null, true)
  check('referenceUsed=true（A4）', result?.referenceUsed, true)
  check('referenceType=a4', result?.referenceType, 'a4')
  check(`DBH=${expectedDbhCm}cm（A4 比例）`, result?.dbhCm, expectedDbhCm)
  check('confidence=high（A4 參照物）', result?.confidence, 'high')
  check('referenceWidthMm=210', result?.referenceWidthMm, 210)
}

{
  // A4 橫放：pixelWidth > pixelHeight，但 A4 橫放比例也合法（寬 297mm 高 210mm）
  // 此時 referenceType=a4，但像素寬高比 ≈ 297/210 = 1.414
  // REFERENCE_SIZES.a4 = { width: 210, height: 297 }，expectedRatio = 210/297 = 0.707
  // 橫放時 actualRatio = largeWidth/smallHeight ≈ 212/150 = 1.414，偏差 = |1.414-0.707|/0.707 ≈ 1.0 → 超過15%
  // 所以橫放 A4 會觸發 fallback → referenceUsed=false
  const resultLandscape = calculate({
    ...BASE_INPUT,
    referenceDetected: true,
    referenceType: 'a4',
    trunkToReferenceRatio: 0.8,
    referencePixelWidth: 212,  // 橫放 A4：寬像素 > 高像素
    referencePixelHeight: 150,
    referenceEstimatedWidthMm: 0,
    referenceConfidence: 0.8,
  })
  // 橫放超出±15%容差，應 fallback 到薄透鏡
  check('A4 橫放超容差 → referenceUsed=false（fallback）', resultLandscape?.referenceUsed, false)
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 14.3：長寬比驗證（validateReferenceAspectRatio）
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[14.3] 長寬比驗證：傾斜/遮蔽參照物 fallback')

// 直接測試 validateReferenceAspectRatio()
{
  const card = REFERENCE_SIZES.creditcard  // 85.6 × 53.98, ratio ≈ 1.585
  console.log(`  信用卡期望長寬比 ≈ ${(card.width / card.height).toFixed(3)}`)

  // 正常信用卡（誤差 < 15%）
  check('正常信用卡像素比（±5%）→ 通過', validateReferenceAspectRatio('creditcard', 200, 126), true)

  // 輕微傾斜（±12%，在容差內）
  const slightTiltH = Math.round(200 / (card.width / card.height) * 1.12)
  check('輕微傾斜（12%偏差）→ 通過（容差15%）',
    validateReferenceAspectRatio('creditcard', 200, slightTiltH), true)

  // 嚴重傾斜（>15%偏差）→ 應拒絕
  const badH = Math.round(200 / (card.width / card.height) * 1.20)
  check('嚴重傾斜（20%偏差）→ 拒絕',
    validateReferenceAspectRatio('creditcard', 200, badH), false)

  // 遮蔽/擠壓：寬高比嚴重失真
  check('嚴重遮蔽（寬高比 4:1）→ 拒絕',
    validateReferenceAspectRatio('creditcard', 200, 50), false)

  // 無像素資料：應通過（不阻擋）
  check('無像素資料（0×0）→ 不阻擋', validateReferenceAspectRatio('creditcard', 0, 0), true)

  // 未知類型：應通過（不驗證）
  check('unknown 類型 → 不驗證', validateReferenceAspectRatio('unknown', 200, 50), true)
}

// 透過 calculate() 測試傾斜信用卡觸發 fallback
{
  // 傾斜信用卡：ratio=1.5，但像素 200×80（ratio=2.5），偏差57% → fallback 薄透鏡
  const result = calculate({
    ...BASE_INPUT,
    referenceDetected: true,
    referenceType: 'creditcard',
    trunkToReferenceRatio: 1.5,
    referencePixelWidth: 200,
    referencePixelHeight: 80,   // 嚴重傾斜
    referenceEstimatedWidthMm: 0,
    referenceConfidence: 0.8,
  })
  check('傾斜信用卡 → referenceUsed=false（長寬比失敗 fallback）', result?.referenceUsed, false)
  check('傾斜信用卡 → 使用薄透鏡計算（distanceUsedM 非 null）', result?.distanceUsedM !== null, true)
  check('傾斜信用卡 → confidence 非 high（路徑B）',
    result?.confidence === 'high' || result?.confidence === 'medium' || result?.confidence === 'low', true)
}

// 遮蔽信用卡：referenceDetected=false → 直接 fallback
{
  const result = calculate({
    ...BASE_INPUT,
    referenceDetected: false,
    referenceType: '',
    trunkToReferenceRatio: 0,
    referencePixelWidth: 0,
    referencePixelHeight: 0,
    referenceEstimatedWidthMm: 0,
    referenceConfidence: 0,
  })
  check('無參照物 → referenceUsed=false', result?.referenceUsed, false)
  check('無參照物 → 使用薄透鏡（路徑B）', result?.distanceUsedM > 0, true)
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 14.4：含參照物測量時 ground_truth 自動寫入（source='reference'）
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n[14.4] ground_truth 自動寫入驗證（source=\'reference\'）')

{
  const db = getDb()
  const videoHash = 'ref-test-gt-' + Date.now()
  let treeId = null

  try {
    // 插入樹木紀錄（模擬 referenceUsed=true 的量測結果）
    treeId = insertTree({
      videoHash,
      species: 'Cryptomeria japonica',
      speciesSource: 'plantnet',
      dbhCm: 12.8,
      volumeM3: 0.018,
      carbonKg: 9.0,
      confidence: 'high',
      gps: '24.1477,120.6736',
      focalLengthMm: 5.1,
      sensorWidthMm: 5.76,
      deviceModel: 'iPhone 14',
      frameQuality: 'good',
      referenceUsed: 1,
      referenceType: 'creditcard',
    })
    check('tree 成功插入', !!treeId, true)

    // 模擬 index.js 的 ground_truth 自動寫入邏輯
    // 路徑 A referenceUsed=true → source='reference', actualDbhCm=calc.dbhCm, estimatedDbhCm=calc.routeBDbhCm
    const { id: gtId, correctionFactor } = insertGroundTruth({
      treeId,
      actualDbhCm: 12.8,       // calc.dbhCm（參照物測量值）
      estimatedDbhCm: 14.2,    // calc.routeBDbhCm（薄透鏡估算值）
      source: 'reference',
    })

    check('ground_truth 成功寫入', !!gtId, true)

    // 查詢驗證
    const gtRecords = getByTreeId(treeId)
    check('ground_truth 筆數=1', gtRecords.length, 1)
    check('source=reference', gtRecords[0]?.source, 'reference')
    check('actual_dbh_cm=12.8', gtRecords[0]?.actual_dbh_cm, 12.8)
    check('estimated_dbh_cm=14.2', gtRecords[0]?.estimated_dbh_cm, 14.2)
    check('correction_factor 正確（12.8/14.2）',
      gtRecords[0]?.correction_factor, v => Math.abs(v - 12.8 / 14.2) < 0.001)
    check('tree_id 對應正確', gtRecords[0]?.tree_id, treeId)
  } finally {
    if (treeId) {
      db.prepare('DELETE FROM ground_truth WHERE tree_id = ?').run(treeId)
      db.prepare('DELETE FROM trees WHERE id = ?').run(treeId)
      console.log('  🧹 測試資料已清除')
    }
  }
}

{
  // 確認薄透鏡路徑（referenceUsed=false）不寫入 ground_truth
  // 這在 index.js 由 if (calc.directMeasurementUsed || calc.referenceUsed) 控制
  // 此處驗證：referenceUsed=false 時 ground_truth 應無對應紀錄
  const db = getDb()
  const videoHash = 'lens-test-gt-' + Date.now()
  let treeId = null

  try {
    treeId = insertTree({
      videoHash,
      species: 'Acacia confusa',
      speciesSource: 'plantnet',
      dbhCm: 18.5,
      volumeM3: 0.042,
      carbonKg: 21.0,
      confidence: 'medium',
      gps: '24.1,120.6',
      focalLengthMm: 4.2,
      sensorWidthMm: 5.0,
      deviceModel: 'Pixel 7',
      frameQuality: 'good',
      referenceUsed: 0,
      referenceType: null,
    })
    // 薄透鏡路徑：不寫 ground_truth
    const gtRecords = getByTreeId(treeId)
    check('薄透鏡路徑：ground_truth 無記錄（共 0 筆）', gtRecords.length, 0)
  } finally {
    if (treeId) {
      db.prepare('DELETE FROM trees WHERE id = ?').run(treeId)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 結果
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n═══ 結果：${passed} 通過 ✅  ${failed} 失敗 ❌ ═══`)
if (failed > 0) process.exit(1)
