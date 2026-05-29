// §35.4/35.5: OpenCV-based frame extraction replaces FFmpeg
// detect_card.py --video scans at 2fps, auto-corrects rotation metadata,
// rotates card frames to horizontal before saving.

const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const DETECT_PY = path.join(__dirname, '../scripts/detect_card.py')

// Extract frames at 2fps using OpenCV VideoCapture + detect card in each frame.
// Saves frames to framesDir as frame_N.jpg; card frames pre-rotated to horizontal.
// Returns { cardFrames, allFrames, frameQuality }
//   cardFrames: sorted by (isOrthogonal desc, sharpness desc)
//   allFrames:  sorted by frameIdx (chronological)
async function extractAndDetectCard(videoPath, framesDir, opts = {}) {
  const fps = opts.fps || 2
  const rotateCW = opts.rotateCW || false

  const args = ['--video', videoPath, '--fps', String(fps), '--save-dir', framesDir]
  if (rotateCW) args.push('--rotate-cw')

  const r = spawnSync('python3', [DETECT_PY, ...args], {
    encoding: 'utf8',
    timeout: 300000,  // 5 min
  })

  if (r.status !== 0 || !r.stdout.trim()) {
    const msg = (r.stderr || '').slice(0, 400)
    if (msg.includes('opencv not installed') || msg.includes('cv2')) {
      throw new Error('OpenCV not installed — run: pip3 install opencv-python-headless')
    }
    throw new Error(`detect_card.py failed: ${msg}`)
  }

  const results = JSON.parse(r.stdout)

  const cardFrames = results
    .filter(r => r.cardDetected)
    .sort((a, b) => {
      const aO = a.isOrthogonal ? 1 : 0
      const bO = b.isOrthogonal ? 1 : 0
      if (bO !== aO) return bO - aO
      return b.sharpness - a.sharpness
    })

  const allFrames = [...results].sort((a, b) => a.frameIdx - b.frameIdx)

  const maxSharpness = allFrames.length > 0 ? Math.max(...allFrames.map(f => f.sharpness)) : 0
  const frameQuality = maxSharpness >= 100 ? 'good' : 'low'

  return { cardFrames, allFrames, frameQuality }
}

// Select n frames evenly distributed across allFrames for full Gemini analysis
// (Path 0, Path B, species detection)
function selectRegularFrames(allFrames, n = 5) {
  if (allFrames.length === 0) return []
  if (allFrames.length <= n) return allFrames
  const step = (allFrames.length - 1) / (n - 1)
  return Array.from({ length: n }, (_, i) => allFrames[Math.round(i * step)])
}

function frameToBase64(framePath) {
  return fs.readFileSync(framePath).toString('base64')
}

module.exports = { extractAndDetectCard, selectRegularFrames, frameToBase64 }
