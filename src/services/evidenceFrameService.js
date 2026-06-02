const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const fs = require('fs')
const path = require('path')

ffmpeg.setFfmpegPath(ffmpegPath)

// 從 median + rawFrames 挑出「測量依據幀」的 index（對應 frames 陣列）
// - 路徑 0：找 directMeasurement 落在 median.directMeasurementCm ±10% 範圍內、信心最高的幀
// - 路徑 A：找 referenceAtTrunk=true、referenceConfidence 最高的幀
// - 路徑 B：回傳 null（純視覺估算無單一依據幀）
function pickEvidenceFrameIdx(median, rawFrames) {
  if (!Array.isArray(rawFrames) || rawFrames.length === 0 || !median) return null

  if ((median.directMeasurementCm || 0) > 0) {
    const target = median.directMeasurementCm
    const candidates = rawFrames
      .map((f, i) => ({ f, i }))
      .filter(({ f }) =>
        (f.directMeasurementCm || 0) > 0 &&
        (f.directMeasurementConfidence || 0) >= 0.5 &&
        Math.abs(f.directMeasurementCm - target) / target <= 0.10
      )
    if (candidates.length > 0) {
      candidates.sort((a, b) =>
        (b.f.directMeasurementConfidence || 0) - (a.f.directMeasurementConfidence || 0)
      )
      return {
        frameIdx: candidates[0].i,
        reason: 'tape',
        value: candidates[0].f.directMeasurementCm,
        measurementType: candidates[0].f.measurementType || '',
        confidence: candidates[0].f.directMeasurementConfidence,
      }
    }
  }

  if (median.referenceDetected && median.referenceAtTrunk) {
    const candidates = rawFrames
      .map((f, i) => ({ f, i }))
      .filter(({ f }) =>
        f.referenceDetected &&
        f.referenceAtTrunk !== false &&
        (f.referenceConfidence || 0) >= 0.4
      )
    if (candidates.length > 0) {
      candidates.sort((a, b) =>
        (b.f.referenceConfidence || 0) - (a.f.referenceConfidence || 0)
      )
      return {
        frameIdx: candidates[0].i,
        reason: 'reference',
        referenceType: candidates[0].f.referenceType || '',
        confidence: candidates[0].f.referenceConfidence,
      }
    }
  }

  return null
}

// 將指定來源 JPG 縮放至 800×600（保留長寬比、長邊 fit），輸出 q:v 4
function generateThumbnail(srcPath, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    ffmpeg(srcPath)
      .outputOptions([
        '-vf', "scale='min(800,iw)':'min(600,ih)':force_original_aspect_ratio=decrease",
        '-q:v', '4',
      ])
      .output(destPath)
      .on('end', () => resolve(destPath))
      .on('error', reject)
      .run()
  })
}

module.exports = { pickEvidenceFrameIdx, generateThumbnail }
