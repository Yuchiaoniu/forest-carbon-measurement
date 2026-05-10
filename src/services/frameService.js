const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

ffmpeg.setFfmpegPath(ffmpegPath)

async function extractFrames(videoPath, outputDir, count = 10) {
  return new Promise((resolve, reject) => {
    const timestamps = []
    // 先取得影片時長
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err) return reject(err)
      const duration = meta.format.duration || 5
      // 均勻取樣時間點（避開頭尾 10%）
      for (let i = 1; i <= count; i++) {
        timestamps.push((duration * 0.1) + (duration * 0.8 * i / (count + 1)))
      }

      const framePaths = []
      let done = 0

      timestamps.forEach((t, idx) => {
        const outPath = path.join(outputDir, `frame_${idx}.jpg`)
        ffmpeg(videoPath)
          .seekInput(t)
          .frames(1)
          .output(outPath)
          .on('end', () => {
            framePaths[idx] = outPath
            done++
            if (done === timestamps.length) resolve(framePaths.filter(Boolean))
          })
          .on('error', () => { done++; if (done === timestamps.length) resolve(framePaths.filter(Boolean)) })
          .run()
      })
    })
  })
}

function getSharpnessScore(framePath) {
  try {
    // 使用 ffmpeg lavfi 的 blurdetect 濾鏡取得模糊值（越低越模糊）
    // blur_slope 越高代表越清晰，但不同版本 ffmpeg 輸出格式不同
    // 改用簡單的 signalstats 取 YAVG，並用 edge 偵測
    const result = execSync(
      `"${ffmpegPath}" -i "${framePath}" -vf "edgedetect=low=0.1:high=0.3,signalstats" -f null - 2>&1`,
      { timeout: 10000 }
    ).toString()
    // 從 YAVG 行取平均亮度作為替代清晰度指標
    const match = result.match(/YAVG:(\d+\.?\d*)/)
    return match ? parseFloat(match[1]) : 50
  } catch {
    return 50
  }
}

async function selectBestFrames(framePaths, targetCount = 3) {
  const scored = framePaths.map(p => ({ path: p, score: getSharpnessScore(p) }))
  scored.sort((a, b) => b.score - a.score)
  const best = scored.slice(0, targetCount)
  const maxScore = best[0]?.score || 0
  const quality = maxScore >= 30 ? 'good' : 'low'
  return { frames: best.map(f => f.path), frameQuality: quality }
}

function frameToBase64(framePath) {
  return fs.readFileSync(framePath).toString('base64')
}

module.exports = { extractFrames, selectBestFrames, frameToBase64 }
