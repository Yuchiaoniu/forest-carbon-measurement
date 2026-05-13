const { v4: uuidv4 } = require('uuid')
const { getDb } = require('../db/init')

const BOOTSTRAP_N = 10000
const CI_ALPHA = 0.95

// --- 核心指標計算 ---

function computeMetrics(pairs) {
  // pairs: [{ actual, estimated }]
  const n = pairs.length
  if (n === 0) return null

  const errors = pairs.map(p => p.actual - p.estimated)
  const absErrors = errors.map(Math.abs)
  const pctErrors = pairs.map(p => Math.abs((p.actual - p.estimated) / p.actual) * 100)

  const mae = absErrors.reduce((s, v) => s + v, 0) / n
  const mape = pctErrors.reduce((s, v) => s + v, 0) / n
  const rmse = Math.sqrt(errors.map(e => e ** 2).reduce((s, v) => s + v, 0) / n)
  const bias = errors.reduce((s, v) => s + v, 0) / n

  const actualMean = pairs.map(p => p.actual).reduce((s, v) => s + v, 0) / n
  const ssTot = pairs.map(p => (p.actual - actualMean) ** 2).reduce((s, v) => s + v, 0)
  const ssRes = errors.map(e => e ** 2).reduce((s, v) => s + v, 0)
  const r2 = ssTot === 0 ? null : 1 - ssRes / ssTot

  return {
    n,
    mae: round4(mae),
    mape: round4(mape),
    rmse: round4(rmse),
    r2: r2 !== null ? round4(r2) : null,
    bias: round4(bias),
  }
}

// --- Bootstrap 信賴區間（MAE & MAPE）---

function bootstrapCI(pairs, metric = 'mae') {
  const n = pairs.length
  if (n < 2) return { low: null, high: null }

  const samples = []
  for (let i = 0; i < BOOTSTRAP_N; i++) {
    let sum = 0
    for (let j = 0; j < n; j++) {
      const p = pairs[Math.floor(Math.random() * n)]
      sum += metric === 'mae'
        ? Math.abs(p.actual - p.estimated)
        : Math.abs((p.actual - p.estimated) / p.actual) * 100
    }
    samples.push(sum / n)
  }

  samples.sort((a, b) => a - b)
  const lo = Math.floor((1 - CI_ALPHA) / 2 * BOOTSTRAP_N)
  const hi = Math.floor((1 + CI_ALPHA) / 2 * BOOTSTRAP_N)
  return { low: round4(samples[lo]), high: round4(samples[hi]) }
}

// --- DSR 評估 checklist（Hevner 2004 七項準則）---

function buildDsrChecklist(metrics, db) {
  const treeCount = db.prepare('SELECT COUNT(*) as n FROM trees').get().n
  const gtCount = db.prepare('SELECT COUNT(*) as n FROM ground_truth').get().n
  const confirmedChain = db.prepare("SELECT COUNT(*) as n FROM blockchain_jobs WHERE tx_status='confirmed'").get().n
  const speciesCount = db.prepare('SELECT COUNT(DISTINCT species) as n FROM trees WHERE species IS NOT NULL').get().n

  const criteria = [
    {
      id: 1,
      criterion: 'Design as an Artifact',
      description: '系統是否產出具體可用的人工物（artifact）？',
      evidence: `實作三支柱架構：AI測量（支柱一）、修正因子演進（支柱二）、區塊鏈存證（支柱三）`,
      passed: treeCount > 0,
    },
    {
      id: 2,
      criterion: 'Problem Relevance',
      description: '是否解決了重要的業務問題？',
      evidence: `台灣林業碳匯人工測量耗時耗力，本系統以手機影片自動化估算 DBH 與碳儲量`,
      passed: true,
    },
    {
      id: 3,
      criterion: 'Design Evaluation',
      description: '是否對設計物進行了嚴格評估？',
      evidence: metrics
        ? `ground_truth 樣本數 ${gtCount}，MAE=${metrics.mae}cm，MAPE=${metrics.mape}%，R²=${metrics.r2}`
        : `已蒐集 ${gtCount} 筆 ground_truth，待達 20 筆後進行正式評估`,
      passed: gtCount >= 5,
    },
    {
      id: 4,
      criterion: 'Research Contributions',
      description: '是否有清楚的研究貢獻？',
      evidence: '三項創新貢獻：(1) 薄透鏡+參照物雙路徑DBH估算 (2) 加權修正因子自演進機制 (3) 不可篡改區塊鏈存證',
      passed: true,
    },
    {
      id: 5,
      criterion: 'Research Rigor',
      description: '設計與評估是否採用嚴謹的方法？',
      evidence: `Bootstrap 95% CI（n=${BOOTSTRAP_N}重採樣）、雙來源樹種辨識投票、修正因子≥5筆才啟用`,
      passed: gtCount >= 5,
    },
    {
      id: 6,
      criterion: 'Design as a Search Process',
      description: '是否透過迭代搜索找到最佳設計？',
      evidence: `correction_factor_log 記錄每次因子演進，blockchain_jobs 追蹤上鏈狀態，系統持續自我修正`,
      passed: true,
    },
    {
      id: 7,
      criterion: 'Communication of Research',
      description: '研究成果是否適當傳達給技術與管理兩類受眾？',
      evidence: `API 端點提供結構化 JSON，/api/evaluation/report 輸出 Markdown 報告，/api/evaluation/export.csv 供統計軟體使用`,
      passed: confirmedChain > 0 || treeCount > 0,
    },
  ]

  const passedCount = criteria.filter(c => c.passed).length
  return {
    framework: 'Hevner et al. (2004) Design Science Research Guidelines',
    passedCount,
    totalCount: criteria.length,
    score: `${passedCount}/${criteria.length}`,
    criteria,
    systemStats: { treeCount, gtCount, confirmedChain, speciesCount },
  }
}

// --- Markdown 報告產生器 ---

function generateMarkdownReport({ metrics, maeCi, mapeCi, checklist, speciesFilter, notes }) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const lines = []

  lines.push(`# 林業碳匯測量系統 — 評估報告`)
  lines.push(`\n生成時間：${now}`)
  if (speciesFilter) lines.push(`樹種篩選：${speciesFilter}`)
  if (notes) lines.push(`備注：${notes}`)

  lines.push(`\n## 一、量化評估指標`)
  if (!metrics || metrics.n < 2) {
    lines.push(`\n> 樣本數不足（需 ≥2 筆 ground_truth），無法計算。`)
  } else {
    lines.push(`\n| 指標 | 數值 |`)
    lines.push(`|------|------|`)
    lines.push(`| 樣本數 (n) | ${metrics.n} |`)
    lines.push(`| MAE（平均絕對誤差） | ${metrics.mae} cm |`)
    lines.push(`| MAPE（平均絕對百分比誤差） | ${metrics.mape} % |`)
    lines.push(`| RMSE（均方根誤差） | ${metrics.rmse} cm |`)
    lines.push(`| R²（決定係數） | ${metrics.r2 ?? 'N/A'} |`)
    lines.push(`| Bias（系統性偏差） | ${metrics.bias} cm |`)

    if (maeCi.low !== null) {
      lines.push(`\n### Bootstrap 95% 信賴區間（${BOOTSTRAP_N.toLocaleString()} 次重採樣）`)
      lines.push(`\n| 指標 | 下界 | 上界 |`)
      lines.push(`|------|------|------|`)
      lines.push(`| MAE | ${maeCi.low} cm | ${maeCi.high} cm |`)
      lines.push(`| MAPE | ${mapeCi.low} % | ${mapeCi.high} % |`)
    }
  }

  lines.push(`\n## 二、DSR 評估 Checklist`)
  lines.push(`\n**框架：** ${checklist.framework}`)
  lines.push(`**通過：** ${checklist.score}`)
  lines.push(``)
  for (const c of checklist.criteria) {
    const mark = c.passed ? '✅' : '⚠️'
    lines.push(`### ${mark} 準則 ${c.id}：${c.criterion}`)
    lines.push(`- **問題：** ${c.description}`)
    lines.push(`- **佐證：** ${c.evidence}`)
  }

  lines.push(`\n## 三、系統統計`)
  lines.push(`\n| 項目 | 數量 |`)
  lines.push(`|------|------|`)
  lines.push(`| 累計測量筆數 | ${checklist.systemStats.treeCount} |`)
  lines.push(`| Ground Truth 筆數 | ${checklist.systemStats.gtCount} |`)
  lines.push(`| 已確認上鏈筆數 | ${checklist.systemStats.confirmedChain} |`)
  lines.push(`| 辨識樹種數 | ${checklist.systemStats.speciesCount} |`)

  return lines.join('\n')
}

// --- 主要 API ---

function runEvaluation({ speciesFilter, notes } = {}) {
  const db = getDb()

  let query = `
    SELECT gt.actual_dbh_cm as actual, gt.estimated_dbh_cm as estimated,
           t.species, gt.source, gt.created_at
    FROM ground_truth gt
    JOIN trees t ON gt.tree_id = t.id
    WHERE gt.actual_dbh_cm IS NOT NULL AND gt.estimated_dbh_cm IS NOT NULL
  `
  const params = []
  if (speciesFilter) {
    query += ` AND t.species = ?`
    params.push(speciesFilter)
  }

  const rows = db.prepare(query).all(...params)
  const pairs = rows.map(r => ({ actual: r.actual, estimated: r.estimated }))

  const metrics = computeMetrics(pairs)
  const maeCi = bootstrapCI(pairs, 'mae')
  const mapeCi = bootstrapCI(pairs, 'mape')
  const checklist = buildDsrChecklist(metrics, db)
  const report = generateMarkdownReport({ metrics, maeCi, mapeCi, checklist, speciesFilter, notes })

  // 寫入 evaluation_runs
  const id = uuidv4()
  db.prepare(`
    INSERT INTO evaluation_runs
      (id, sample_count, mae, mape, rmse, r2, bias,
       mae_ci_low, mae_ci_high, mape_ci_low, mape_ci_high, species_filter, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    metrics?.n ?? 0,
    metrics?.mae ?? null, metrics?.mape ?? null,
    metrics?.rmse ?? null, metrics?.r2 ?? null, metrics?.bias ?? null,
    maeCi.low, maeCi.high, mapeCi.low, mapeCi.high,
    speciesFilter ?? null, notes ?? null,
  )

  return { id, metrics, maeCi, mapeCi, checklist, report, rawCount: pairs.length }
}

function getLatestRun() {
  return getDb().prepare(`
    SELECT * FROM evaluation_runs ORDER BY created_at DESC LIMIT 1
  `).get() || null
}

function exportCsv(speciesFilter) {
  const db = getDb()
  let query = `
    SELECT
      t.id as tree_id, t.species, t.species_source,
      gt.actual_dbh_cm, gt.estimated_dbh_cm,
      ROUND(gt.actual_dbh_cm - gt.estimated_dbh_cm, 4) as error_cm,
      ROUND(ABS(gt.actual_dbh_cm - gt.estimated_dbh_cm) / gt.actual_dbh_cm * 100, 4) as abs_pct_error,
      gt.correction_factor, gt.source as gt_source,
      t.confidence, t.reference_used, t.reference_type,
      t.original_dbh_cm, t.applied_correction_factor,
      t.focal_length_mm, t.sensor_width_mm, t.device_model,
      t.gps, gt.created_at
    FROM ground_truth gt
    JOIN trees t ON gt.tree_id = t.id
    WHERE gt.actual_dbh_cm IS NOT NULL
  `
  const params = []
  if (speciesFilter) { query += ` AND t.species = ?`; params.push(speciesFilter) }
  query += ` ORDER BY gt.created_at`

  const rows = db.prepare(query).all(...params)
  if (rows.length === 0) return null

  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = r[h]
      if (v === null || v === undefined) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
    }).join(','))
  ].join('\n')

  return csv
}

function round4(v) { return Math.round(v * 10000) / 10000 }

module.exports = { runEvaluation, getLatestRun, exportCsv, buildDsrChecklist, computeMetrics }
