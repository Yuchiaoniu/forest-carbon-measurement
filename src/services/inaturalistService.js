const axios = require('axios')
const fs = require('fs')
const FormData = require('form-data')

const INAT_URL = 'https://api.inaturalist.org/v1/computervision/score_image'

async function identifySpecies(framePaths, apiToken) {
  try {
    const form = new FormData()
    // iNaturalist 每次只送一張圖，送最清晰的那幀
    form.append('image', fs.createReadStream(framePaths[0]))

    const res = await axios.post(INAT_URL, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${apiToken}`,
      },
      timeout: 15000,
    })

    const results = res.data.results
    if (!results || results.length === 0) {
      console.log('[iNaturalist] 無結果')
      return null
    }

    const best = results[0]
    const taxon = best.taxon
    const scientificName = taxon?.name || null
    const rank = taxon?.rank || null
    const commonName = taxon?.preferred_common_name || taxon?.english_common_name || null
    const score = best.combined_score || best.vision_score || 0

    console.log(`[iNaturalist] ${scientificName} (${rank}) 分數=${score.toFixed(3)}`)

    // 只接受 species 或 genus 層級的結果
    if (!['species', 'genus', 'subspecies'].includes(rank)) {
      console.log(`[iNaturalist] 層級太高(${rank})，跳過`)
      return null
    }

    return {
      species: scientificName,
      commonName,
      rank,
      confidence: score,
      source: 'inaturalist',
    }
  } catch (err) {
    console.error('[iNaturalist] 錯誤：', err.response?.status, err.response?.data?.error || err.message)
    return null
  }
}

module.exports = { identifySpecies }
