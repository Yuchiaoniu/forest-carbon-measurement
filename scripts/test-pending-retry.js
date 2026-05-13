require('dotenv').config()
const { randomUUID } = require('crypto')
const path = require('path')
const { getDb } = require('../src/db/init')
const { insert, updateTxHash, getPendingTx } = require('../src/db/trees')

let passed = 0, failed = 0
function check(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}：預期 "${expected}"，實際 "${actual}"`)
    failed++
  }
}

async function attemptBlockchain(rpcUrl, contractAddress, privateKey, data) {
  const { ethers } = require('ethers')
  const ABI = [
    'function recordMeasurement(string gps, string species, uint32 dbhMm, uint32 volumeCm3x100, uint32 carbonG, bytes32 videoHash) returns (uint256)',
  ]
  // staticNetwork prevents automatic network-detection polling that keeps process alive
  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true })
  const wallet = new ethers.Wallet(privateKey, provider)
  const contract = new ethers.Contract(contractAddress, ABI, wallet)
  try {
    const dbhMm = Math.round(data.dbhCm * 10)
    const volumeCm3x100 = Math.round(data.volumeM3 * 1e6)
    const carbonG = Math.round(data.carbonKg * 1000)
    const tx = await contract.recordMeasurement(
      data.gps || '', data.species || 'unknown',
      dbhMm, volumeCm3x100, carbonG,
      ethers.zeroPadBytes(ethers.toUtf8Bytes(data.videoHash.slice(0, 32)), 32),
      { gasLimit: 300000, gasPrice: 0 }
    )
    const receipt = await tx.wait()
    return { ok: true, txHash: receipt.hash }
  } catch (err) {
    return { ok: false, error: err.message }
  } finally {
    provider.destroy()
  }
}

async function main() {
  console.log('🧪 Besu 節點不可達 → pending 重試機制測試\n')

  const db = getDb()
  const testHash = 'retry-test-' + Date.now()
  const DUMMY_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  const DUMMY_CONTRACT = '0x0000000000000000000000000000000000000001'

  const testId = insert({
    videoHash: testHash,
    species: 'Cryptomeria japonica', speciesSource: 'plantnet',
    dbhCm: 25.0, volumeM3: 0.05, carbonKg: 25.0,
    confidence: 'high', gps: '25.0417,121.5257',
    focalLengthMm: 4.2, sensorWidthMm: 5.76,
    deviceModel: 'iPhone 14', frameQuality: 'good',
    txStatus: 'pending',
  })
  console.log(`📝 插入測試記錄 id=${testId}`)

  // Test 1: pending 記錄可被 getPendingTx 查到
  console.log('\n[Test 1] getPendingTx 查到 pending 記錄')
  const pendingList = getPendingTx()
  const foundInPending = pendingList.find(r => r.id === testId)
  check('pending 清單包含測試記錄', !!foundInPending, true)
  check('tx_hash 為 null', foundInPending?.tx_hash, null)
  check('tx_status 為 pending', foundInPending?.tx_status, 'pending')

  // Test 2: 節點不可達時，recordMeasurement 拋出錯誤
  console.log('\n[Test 2] 節點不可達時，上鏈應失敗（不影響 SQLite 記錄）')
  const result = await attemptBlockchain(
    'http://127.0.0.1:19999',  // 不存在的端點
    DUMMY_CONTRACT,
    DUMMY_KEY,
    { gps: '25.0417,121.5257', species: 'Cryptomeria japonica', dbhCm: 25.0, volumeM3: 0.05, carbonKg: 25.0, videoHash: testHash }
  )
  check('呼叫失敗（預期）', result.ok, false)
  console.log(`  (錯誤訊息: ${result.error?.slice(0, 80)})`)

  // 驗證 SQLite 記錄仍然是 pending（模擬 index.js 的 catch 行為）
  if (!result.ok) {
    // index.js 在 catch 中不呼叫 updateTxHash，記錄保持 pending
    // 這裡直接驗證 DB 狀態
  }
  const afterFail = db.prepare('SELECT tx_status, tx_hash FROM trees WHERE id = ?').get(testId)
  check('上鏈失敗後記錄仍為 pending', afterFail?.tx_status, 'pending')
  check('tx_hash 仍為 null', afterFail?.tx_hash, null)

  // Test 3: updateTxHash 模擬重試成功
  console.log('\n[Test 3] 重試成功時，updateTxHash 正確更新記錄')
  const fakeTxHash = '0x' + 'a'.repeat(64)
  updateTxHash(testId, fakeTxHash, 'confirmed')
  const afterUpdate = db.prepare('SELECT tx_status, tx_hash FROM trees WHERE id = ?').get(testId)
  check('tx_status 更新為 confirmed', afterUpdate?.tx_status, 'confirmed')
  check('tx_hash 已寫入', afterUpdate?.tx_hash, fakeTxHash)

  // Test 4: confirmed 後不再出現在 getPendingTx
  console.log('\n[Test 4] confirmed 後從 pending 清單移除')
  const pendingAfter = getPendingTx()
  const stillInPending = pendingAfter.find(r => r.id === testId)
  check('不再出現於 pending 清單', !!stillInPending, false)

  // Test 5: 驗證 getPendingTx 查詢條件（tx_hash IS NULL）
  console.log('\n[Test 5] 有 tx_hash 但 tx_status=pending 的記錄不列入重試')
  const mixedId = randomUUID()
  const mixedHash = 'mixed-test-' + Date.now()
  db.prepare(`INSERT INTO trees (id, video_hash, species, dbh_cm, volume_m3, carbon_kg, confidence, tx_status, tx_hash)
    VALUES (?, ?, 'Test', 10.0, 0.01, 5.0, 'low', 'pending', '0xabcd')`
  ).run(mixedId, mixedHash)
  const pendingWithHash = getPendingTx().find(r => r.id === mixedId)
  check('有 tx_hash 的 pending 記錄不列入重試', !!pendingWithHash, false)
  db.prepare('DELETE FROM trees WHERE id = ?').run(mixedId)

  // 清理
  db.prepare('DELETE FROM trees WHERE id = ?').run(testId)
  console.log('\n🧹 測試資料已清除')

  console.log(`\n═══ 結果：${passed} 通過 ✅  ${failed} 失敗 ❌ ═══`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('❌ 錯誤：', e.message); process.exit(1) })
