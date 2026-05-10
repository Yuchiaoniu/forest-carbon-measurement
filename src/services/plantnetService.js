const axios = require('axios')
const fs = require('fs')
const FormData = require('form-data')

const PLANTNET_URL = 'https://my-api.plantnet.org/v2/identify/all'

async function identifySpecies(framePaths, apiKey) {
  try {
    const form = new FormData()
    const images = framePaths.slice(0, 2)

    // Pl@ntNet 要求 images 和 organs 數量一致，逐一對應
    images.forEach(p => form.append('images', fs.createReadStream(p)))
    images.forEach(() => form.append('organs', 'bark'))

    const res = await axios.post(
      `${PLANTNET_URL}?api-key=${apiKey}&lang=en&include-related-images=false`,
      form,
      { headers: form.getHeaders(), timeout: 15000 }
    )

    const best = res.data.results?.[0]
    if (!best) {
      console.log('[Pl@ntNet] 無結果')
      return null
    }

    console.log(`[Pl@ntNet] ${best.species?.scientificNameWithoutAuthor} 信心=${(best.score*100).toFixed(1)}%`)

    return {
      species: best.species?.scientificNameWithoutAuthor || null,
      commonName: best.species?.commonNames?.[0] || null,
      confidence: best.score || 0,
      source: 'plantnet',
    }
  } catch (err) {
    console.error('[Pl@ntNet] 錯誤：', err.response?.status, err.response?.data?.message || err.message)
    return null
  }
}

module.exports = { identifySpecies }
