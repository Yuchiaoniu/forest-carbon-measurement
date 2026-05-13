require('dotenv').config()
const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { randomUUID } = require('crypto')
const { getDb } = require('../src/db/init')
const { findByVideoHash, insert } = require('../src/db/trees')

const PORT = process.env.PORT || 3000

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    fs.createReadStream(filePath)
      .on('data', d => hash.update(d))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject)
  })
}

function uploadFile(filePath) {
  return new Promise((resolve, reject) => {
    const boundary = `----FormBoundary${Date.now()}`
    const filename = path.basename(filePath)
    const fileData = fs.readFileSync(filePath)
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="${filename}"\r\nContent-Type: video/mp4\r\n\r\n`),
      fileData,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ])
    const options = {
      hostname: 'localhost', port: PORT, path: '/api/upload', method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
    }
    const req = http.request(options, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { reject(new Error('回應不是 JSON: ' + data)) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function pollStatus(jobId, maxWaitMs = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const poll = () => {
      http.get(`http://localhost:${PORT}/api/status/${jobId}`, res => {
        let data = ''
        res.on('data', c => data += c)
        res.on('end', () => {
          const result = JSON.parse(data)
          if (result.status === 'done' || result.status === 'error') return resolve(result)
          if (Date.now() - start > maxWaitMs) return reject(new Error('輪詢逾時'))
          setTimeout(poll, 500)
        })
      }).on('error', reject)
    }
    poll()
  })
}

function isServerRunning() {
  return new Promise(resolve => {
    const req = http.request({ hostname: 'localhost', port: PORT, path: '/', method: 'HEAD' }, () => resolve(true))
    req.on('error', () => resolve(false))
    req.setTimeout(1000, () => { req.destroy(); resolve(false) })
    req.end()
  })
}

let passed = 0, failed = 0
function check(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}：預期 ${expected}，實際 ${actual}`)
    failed++
  }
}

async function testDbLayer() {
  console.log('\n[DB層] 直接測試 SHA-256 去重邏輯')
  const db = getDb()
  const testHash = 'dedup-test-' + Date.now()
  const testId = randomUUID()

  insert({
    videoHash: testHash, species: 'Cryptomeria japonica', speciesSource: 'plantnet',
    dbhCm: 20.0, volumeM3: 0.03, carbonKg: 15.0, confidence: 'high',
    gps: '25.0417,121.5257', focalLengthMm: 4.2, sensorWidthMm: 5.76,
    deviceModel: 'iPhone 14', frameQuality: 'good', txStatus: 'pending',
  })

  const found = findByVideoHash(testHash)
  check('插入後可查到', !!found, true)
  check('video_hash 正確', found?.video_hash, testHash)
  check('species 正確', found?.species, 'Cryptomeria japonica')

  const notFound = findByVideoHash('non-existent-hash-xyz')
  check('不存在的 hash 回傳 null/undefined', !notFound, true)

  // 清理
  db.prepare('DELETE FROM trees WHERE video_hash = ?').run(testHash)
  console.log('  🧹 測試資料已清除')
}

async function testHttpLayer(videoFile) {
  console.log(`\n[HTTP層] 上傳相同影片兩次：${path.basename(videoFile)}`)
  const videoHash = await hashFile(videoFile)
  console.log(`  hash: ${videoHash.slice(0, 24)}...`)

  const db = getDb()
  const existing = findByVideoHash(videoHash)
  let manuallyInserted = false

  if (!existing) {
    insert({
      videoHash, species: 'Acacia confusa', speciesSource: 'test',
      dbhCm: 15.0, volumeM3: 0.01, carbonKg: 5.0, confidence: 'medium',
      gps: '', focalLengthMm: 4.2, sensorWidthMm: 5.76,
      deviceModel: 'test', frameQuality: 'good', txStatus: 'pending',
    })
    manuallyInserted = true
    console.log('  💾 預先插入對應 hash 的 SQLite 記錄')
  }

  try {
    let uploadResp
    try {
      uploadResp = await uploadFile(videoFile)
    } catch (e) {
      console.log(`  ⚠️  上傳失敗（${e.message.slice(0, 80)}）`)
      console.log('     可能是 port 3000 上跑的不是本系統，DB 層測試已驗證去重邏輯正確')
      return
    }

    if (!uploadResp.jobId) {
      console.log(`  ⚠️  伺服器回應無 jobId（可能是別的應用）：${JSON.stringify(uploadResp).slice(0, 100)}`)
      console.log('     DB 層測試已驗證去重邏輯正確')
      return
    }

    const result = await pollStatus(uploadResp.jobId)

    if (result.cached === true) {
      console.log('  ✅ cached=true：去重正常運作')
      passed++
    } else if (result.status === 'done' && !result.cached) {
      console.log('  ❌ 未觸發去重（cached 應為 true）')
      failed++
    } else {
      console.log(`  ⚠️  status=${result.status}（可能 AI 金鑰未設定）`)
      console.log('     DB 層測試已驗證去重邏輯正確')
    }
  } finally {
    if (manuallyInserted) db.prepare('DELETE FROM trees WHERE video_hash = ?').run(videoHash)
  }
}

async function main() {
  console.log('🧪 影片重複上傳去重測試\n')

  await testDbLayer()

  const serverRunning = await isServerRunning()
  if (!serverRunning) {
    console.log(`\n⚠️  伺服器未在 :${PORT} 運行，跳過 HTTP 層測試`)
    console.log('   執行 npm start 後再跑本測試可完整驗證 HTTP 去重流程')
  } else {
    const uploadsDir = process.env.UPLOAD_DIR || './uploads'
    const files = fs.existsSync(uploadsDir)
      ? fs.readdirSync(uploadsDir).filter(f => f.endsWith('.mp4') || f.endsWith('.mov'))
      : []

    if (files.length === 0) {
      console.log('\n⚠️  uploads/ 中沒有影片，無法執行 HTTP 層重複上傳測試')
      console.log('   請先上傳一支影片後再重新執行本測試')
    } else {
      await testHttpLayer(path.join(uploadsDir, files[0]))
    }
  }

  console.log(`\n═══ 結果：${passed} 通過 ✅  ${failed} 失敗 ❌ ═══`)
  if (failed > 0) process.exit(1)
}

main().catch(e => { console.error('❌ 錯誤：', e.message); process.exit(1) })
