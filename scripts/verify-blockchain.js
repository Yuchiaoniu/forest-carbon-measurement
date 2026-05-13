require('dotenv').config()
const { ethers } = require('ethers')
const { getDb } = require('../src/db/init')

const EVENT_ABI = [
  'event MeasurementRecorded(uint256 indexed id, string gps, string species, uint32 dbhMm, uint32 carbonG, bytes32 videoHash, uint256 timestamp)',
]

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
        LIMIT 10
      `).all()

  if (rows.length === 0) {
    console.log('找不到 confirmed 的上鏈紀錄。請先確認有成功上鏈的測量。')
    return
  }

  if (!process.env.BESU_RPC_URL) {
    console.error('BESU_RPC_URL 未設定，請檢查 .env')
    process.exit(1)
  }

  const provider = new ethers.JsonRpcProvider(process.env.BESU_RPC_URL)
  const iface = new ethers.Interface(EVENT_ABI)

  let passed = 0, failed = 0

  for (const row of rows) {
    console.log(`\n🔍 tree=${row.id.slice(0, 8)}... txHash=${row.tx_hash?.slice(0, 18)}...`)

    if (!row.tx_hash) {
      console.log('  ⚠️  tx_hash 為空，跳過')
      continue
    }

    try {
      const receipt = await provider.getTransactionReceipt(row.tx_hash)
      if (!receipt) {
        console.log('  ❌ 找不到交易 receipt（節點可能未同步）')
        failed++
        continue
      }

      const matchedLog = receipt.logs.find(log => {
        try { return iface.parseLog(log) !== null } catch { return false }
      })

      if (!matchedLog) {
        console.log('  ❌ 找不到 MeasurementRecorded 事件')
        failed++
        continue
      }

      const event = iface.parseLog(matchedLog)
      const { gps, species, dbhMm, carbonG } = event.args

      const dbhMmExpected = Math.round(row.dbh_cm * 10)
      const carbonGExpected = Math.round(row.carbon_kg * 1000)

      const checks = [
        ['species',  String(species),      String(row.species || '')],
        ['dbhMm',    String(Number(dbhMm)), String(dbhMmExpected)],
        ['carbonG',  String(Number(carbonG)), String(carbonGExpected)],
        ['gps',      String(gps),           String(row.gps || '')],
      ]

      let rowOk = true
      for (const [field, onChain, inDb] of checks) {
        if (onChain !== inDb) {
          console.log(`  ❌ ${field} 不符 — 鏈上: ${onChain}  SQLite: ${inDb}`)
          rowOk = false
        }
      }

      if (rowOk) {
        console.log(`  ✅ 一致 — species="${species}" dbhMm=${Number(dbhMm)} carbonG=${Number(carbonG)}`)
        passed++
      } else {
        failed++
      }
    } catch (err) {
      console.log(`  ❌ 查詢錯誤：${err.message}`)
      failed++
    }
  }

  console.log(`\n═══ 結果：${passed} 筆一致 ✅  ${failed} 筆不符 ❌ ═══`)
  if (failed > 0) process.exit(1)
}

main().catch(e => { console.error(e.message); process.exit(1) })
