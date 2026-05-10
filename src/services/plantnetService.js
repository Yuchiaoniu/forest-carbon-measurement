const axios = require('axios')
const fs = require('fs')
const FormData = require('form-data')

const PLANTNET_URL = 'https://my-api.plantnet.org/v2/identify/all'

async function identifySpecies(framePaths, apiKey) {
  try {
    const form = new FormData()
    framePaths.slice(0, 2).forEach(p => {
      form.append('images', fs.createReadStream(p))
    })
    form.append('organs', 'bark')
    form.append('organs', 'habit')

    const res = await axios.post(`${PLANTNET_URL}?api-key=${apiKey}&lang=zh-TW`, form, {
      headers: form.getHeaders(),
      timeout: 15000,
    })

    const best = res.data.results?.[0]
    if (!best) return null

    return {
      species: best.species?.scientificNameWithoutAuthor || null,
      commonName: best.species?.commonNames?.[0] || null,
      confidence: best.score || 0,
      source: 'plantnet',
    }
  } catch (err) {
    return null
  }
}

module.exports = { identifySpecies }
