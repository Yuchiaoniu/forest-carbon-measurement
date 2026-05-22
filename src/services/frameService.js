const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const ffprobePath = require('@ffprobe-installer/ffprobe').path
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

// 前段（前20%）取5幀，確保捕捉到參照物；後段（後80%）取8幀均勻取樣
const FRONT_FRAMES = 5
const BACK_FRAMES = 8

async function extractFrames(videoPath, outputDir) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err) return reject(err)
      const duration = meta.format.duration || 5

      const frontEnd = duration * 0.20
      const backStart = frontEnd
      const backEnd = duration * 0.95

      const frontTs = Array.from({ length: FRONT_FRAMES }, (_, i) =>
        frontEnd * (i + 1) / (FRONT_FRAMES + 1)
      )
      const backTs = Array.from({ length: BACK_FRAMES }, (_, i) =>
        backStart + (backEnd - backStart) * (i + 1) / (BACK_FRAMES + 1)
      )

      const timestamps = [...frontTs, ...backTs]
      const framePaths = []
      let done = 0

      timestamps.forEach((t, idx) => {
        const outPath = path.join(outputDir, `frame_${idx}.jpg`)
        ffmpeg(videoPath)
          .seekInput(t)
          .frames(1)
          .output(outPath)
          .on('end', () => { framePaths[idx] = outPath; done++; if (done === timestamps.length) resolve(framePaths.filter(Boolean)) })
          .on('error', () => { done++; if (done === timestamps.length) resolve(framePaths.filter(Boolean)) })
          .run()
      })
    })
  })
}

// Laplacian variance (Pertuz et al., 2013): 對灰階影像套用 Laplacian 卷積核，
// 取像素標準差的平方作為清晰度分數，值越高代表影像越清晰。
function getSharpnessScore(framePath) {
  try {
    const result = execSync(
      `"${ffmpegPath}" -i "${framePath}" -vf "format=gray,convolution=0 1 0 1 -4 1 0 1 0:0 1 0 1 -4 1 0 1 0:0 1 0 1 -4 1 0 1 0:0 1 0 1 -4 1 0 1 0:1:1:1:1:128:128:128:128,signalstats" -f null - 2>&1`,
      { timeout: 10000 }
    ).toString()
    const match = result.match(/YSTDDEV:(\d+\.?\d*)/)
    return match ? parseFloat(match[1]) ** 2 : 0
  } catch {
    return 0
  }
}

// 前段取 2 幀（保留參照物出現機率）+ 後段取 3 幀（多角度）= 共 5 幀送 Gemini
async function selectBestFrames(framePaths) {
  const score = (p) => ({ path: p, score: getSharpnessScore(p) })
  const sortDesc = (arr) => [...arr].sort((a, b) => b.score - a.score)

  const frontScored = sortDesc(framePaths.slice(0, FRONT_FRAMES).map(score))
  const backScored  = sortDesc(framePaths.slice(FRONT_FRAMES).map(score))

  const best = [...frontScored.slice(0, 2), ...backScored.slice(0, 3)]
  const maxScore = Math.max(...best.map(f => f.score))
  const quality = maxScore >= 100 ? 'good' : 'low'  // YSTDDEV ≥ 10 → variance ≥ 100
  return { frames: best.map(f => f.path), frameQuality: quality }
}

function frameToBase64(framePath) {
  return fs.readFileSync(framePath).toString('base64')
}

module.exports = { extractFrames, selectBestFrames, frameToBase64 }
