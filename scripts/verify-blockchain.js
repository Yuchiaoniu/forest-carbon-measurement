require('dotenv').config()
const { ethers } = require('ethers')
const { getDb } = require('../src/db/init')

// 修正：補齊合約實際參數（原 ABI 缺少 volumeCm3x100/localTreeId/originalDbhMm/correctionFactorX10000，
// 導致 topic[0] 雜湊不符，無法解析事件）
const EVENT_ABI = [
  'event MeasurementRecorded(uint256 indexed id, string gps, string species, uint32 dbhMm, uint32 volumeCm3x100, uint32 carbonG, bytes32 videoHash, uint256 timestamp, uint256 localTreeId, uint32 originalDbhMm, uint32 correctionFactorX10000)',
]

const NODE_RPCS = [
  { name: 'bootnode',  url: 'http://35.227.93.38:8545' },
  { name: 'member-1', url: 'http://35.193.148.127:8545' },
  { name: 'member-2', url: 'http://35.252.217.29:8545' },
]

async function fetchReceipt(url, txHash) {
  const p = new ethers.JsonRpcProvider(url)
  return p.getTransactionReceipt(txHash).catch(() => null)
}

async function main() {
  const treeId = process.argv[2]

  const db = getDb()
  const rows = treeId
    ? db.prepare(`
        SELECT t.*, bj.tx_hash, bj.tx_status, bj.retry_count
        FROM trees t
        JOIN blockchain_jobs bj ON bj.tree_id = t.id
        WHERE t.id = ? AND bj.tx_status = 'confirmed'
      `).all(treeId)
    : db.prepare(`
        SELECT t.*, bj.tx_hash, bj.tx_status, bj.retry_count
        FROM trees t
        JOIN blockchain_jobs bj ON bj.tree_id = t.id
        WHERE bj.tx_status = 'confirmed'
      `).all()

  if (rows.length === 0) {
    console.log('找不到 confirmed 的上鏈紀錄。')
    return
  }

  if (!process.env.BESU_RPC_URL) {
    console.error('BESU_RPC_URL 未設定，請檢查 .env')
    process.exit(1)
  }

  const primary = new ethers.JsonRpcProvider(process.env.BESU_RPC_URL)
  const iface = new ethers.Interface(EVENT_ABI)
  const contractAddr = (process.env.CONTRACT_ADDRESS || '').toLowerCase()

  let passed = 0, fieldFail = 0, nodeFail = 0

  for (const row of rows) {
    const shortId  = row.id.slice(0, 8)
    const shortTx  = row.tx_hash ? row.tx_hash.slice(0, 18) + '…' : '(無)'
    console.log(`\n🔍 tree=${shortId}… tx=${shortTx}`)

    if (!row.tx_hash) { console.log('  ⚠️  tx_hash 為空，跳過'); continue }

    try {
      // ── 步驟 1：從主節點取 receipt，比對事件欄位 ──────────────────
      const receipt = await primary.getTransactionReceipt(row.tx_hash)
      if (!receipt) {
        console.log('  ❌ 找不到交易 receipt（節點可能未同步）')
        fieldFail++; continue
      }

      const targetLogs = contractAddr
        ? receipt.logs.filter(l => l.address.toLowerCase() === contractAddr)
        : receipt.logs

      const matchedLog = targetLogs.find(log => {
        try { return iface.parseLog(log) !== null } catch { return false }
      })

      if (!matchedLog) {
        console.log(`  ❌ 找不到 MeasurementRecorded 事件（合約 log 數：${targetLogs.length}）`)
        fieldFail++; continue
      }

      const event = iface.parseLog(matchedLog)
      const { gps, species, dbhMm, carbonG } = event.args

      const dbhMmExp  = Math.round(row.dbh_cm * 10)
      const carbonGExp = Math.round(row.carbon_kg * 1000)

      const checks = [
        ['species', String(species),        String(row.species || '')],
        ['dbhMm',   String(Number(dbhMm)),  String(dbhMmExp)],
        ['carbonG', String(Number(carbonG)), String(carbonGExp)],
        ['gps',     String(gps),            String(row.gps || '')],
      ]

      let rowOk = true
      for (const [field, onChain, inDb] of checks) {
        if (onChain !== inDb) {
          console.log(`  ❌ ${field} 不符 — 鏈上: ${onChain}  SQLite: ${inDb}`)
          rowOk = false
        }
      }
      if (!rowOk) { fieldFail++; continue }

      // ── 步驟 2：三節點一致性比對 ──────────────────────────────────
      const receipts = await Promise.all(
        NODE_RPCS.map(n => fetchReceipt(n.url, row.tx_hash))
      )

      let nodeOk = true
      for (let i = 0; i < NODE_RPCS.length; i++) {
        const r = receipts[i]
        const nName = NODE_RPCS[i].name
        if (!r) {
          console.log(`  ⚠️  ${nName} 無回應`)
          nodeOk = false
        } else if (r.status !== 1) {
          console.log(`  ❌ ${nName} status=${r.status}（異常）`)
          nodeOk = false
        } else if (r.blockHash !== receipt.blockHash) {
          console.log(`  ❌ ${nName} blockHash 不一致（節點未同步）`)
          nodeOk = false
        } else {
          console.log(`  ✓  ${nName} 一致（block #${r.blockNumber}）`)
        }
      }

      if (nodeOk) {
        console.log(`  ✅ 全通過 — species="${species}" dbhMm=${Number(dbhMm)} carbonG=${Number(carbonG)}`)
        passed++
      } else {
        console.log(`  ⚠️  欄位正確但節點不一致`)
        nodeFail++
      }

    } catch (err) {
      console.log(`  ❌ 查詢錯誤：${err.message}`)
      fieldFail++
    }
  }

  const total = rows.length
  console.log('\n' + '═'.repeat(55))
  console.log(`  總筆數：${total}`)
  console.log(`  欄位一致 + 三節點一致 ✅  ${passed} 筆`)
  console.log(`  欄位不符 ❌              ${fieldFail} 筆`)
  console.log(`  節點不一致 ⚠️            ${nodeFail} 筆`)
  console.log(`  上鏈成功率：${((passed / total) * 100).toFixed(1)}%`)
  console.log(`  三節點一致率：${(((total - nodeFail) / total) * 100).toFixed(1)}%`)
  console.log('═'.repeat(55))

  if (fieldFail > 0 || nodeFail > 0) process.exit(1)
}

main().catch(e => { console.error(e.message); process.exit(1) })
