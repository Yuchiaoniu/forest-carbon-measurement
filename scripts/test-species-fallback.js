require('dotenv').config()

const MIN_SPECIES_CONFIDENCE = parseFloat(process.env.SPECIES_MIN_CONFIDENCE || '0.3')

// Mirrors the species-resolution logic in src/index.js
function resolveSpecies(plantnetResult, inatResult) {
  const speciesVotes = {}

  if (plantnetResult?.species && (plantnetResult.confidence ?? 0) >= MIN_SPECIES_CONFIDENCE)
    speciesVotes[plantnetResult.species] = { score: plantnetResult.confidence, source: 'plantnet' }
  if (inatResult?.species && (inatResult.confidence ?? 0) >= MIN_SPECIES_CONFIDENCE)
    speciesVotes[inatResult.species] = { score: inatResult.confidence, source: 'inaturalist' }

  const votes = Object.entries(speciesVotes)

  if (votes.length === 2) {
    const [a, b] = votes
    const sameGenus = a[0].split(' ')[0] === b[0].split(' ')[0]
    if (sameGenus) {
      const winner = a[1].score >= b[1].score ? a : b
      return { species: winner[0], speciesSource: 'dual-' + winner[1].source, needsGemini: false }
    } else {
      const winner = a[1].score >= b[1].score ? a : b
      return { species: winner[0], speciesSource: winner[1].source + '-only', needsGemini: false }
    }
  } else if (votes.length === 1) {
    return { species: votes[0][0], speciesSource: votes[0][1].source, needsGemini: false }
  } else {
    return { species: null, speciesSource: 'gemini', needsGemini: true }
  }
}

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

console.log(`\n🧪 樹種辨識信心閾值測試（MIN=${MIN_SPECIES_CONFIDENCE}）\n`)

console.log('[Case 1] Pl@ntNet 高信心 (0.85) → 使用 Pl@ntNet')
{
  const r = resolveSpecies({ species: 'Cryptomeria japonica', confidence: 0.85 }, null)
  check('needsGemini=false', r.needsGemini, false)
  check('speciesSource=plantnet', r.speciesSource, 'plantnet')
  check('species 正確', r.species, 'Cryptomeria japonica')
}

console.log('\n[Case 2] Pl@ntNet 低信心 (0.15)，無 iNat → Gemini fallback')
{
  const r = resolveSpecies({ species: 'Cryptomeria japonica', confidence: 0.15 }, null)
  check('needsGemini=true', r.needsGemini, true)
}

console.log('\n[Case 3] Pl@ntNet 低信心 (0.2) + iNat 高信心 (0.7) → 使用 iNat')
{
  const r = resolveSpecies(
    { species: 'Cryptomeria japonica', confidence: 0.2 },
    { species: 'Cryptomeria japonica', confidence: 0.7 }
  )
  check('needsGemini=false', r.needsGemini, false)
  check('speciesSource=inaturalist', r.speciesSource, 'inaturalist')
}

console.log('\n[Case 4] 兩者都低信心 → Gemini fallback')
{
  const r = resolveSpecies(
    { species: 'Unknown sp.', confidence: 0.1 },
    { species: 'Unknown sp.', confidence: 0.2 }
  )
  check('needsGemini=true', r.needsGemini, true)
}

console.log('\n[Case 5] 兩者高信心同屬 → dual-plantnet（取信心較高）')
{
  const r = resolveSpecies(
    { species: 'Cinnamomum camphora', confidence: 0.9 },
    { species: 'Cinnamomum japonicum', confidence: 0.7 }
  )
  check('needsGemini=false', r.needsGemini, false)
  check('speciesSource=dual-plantnet', r.speciesSource, 'dual-plantnet')
  check('選高信心那個', r.species, 'Cinnamomum camphora')
}

console.log('\n[Case 6] 兩者高信心不同屬 → 取信心較高者-only')
{
  const r = resolveSpecies(
    { species: 'Cinnamomum camphora', confidence: 0.6 },
    { species: 'Acacia confusa', confidence: 0.8 }
  )
  check('needsGemini=false', r.needsGemini, false)
  check('speciesSource=inaturalist-only', r.speciesSource, 'inaturalist-only')
  check('選高信心（Acacia）', r.species, 'Acacia confusa')
}

console.log('\n[Case 7] 恰好在閾值上 (0.3) → 接受')
{
  const r = resolveSpecies({ species: 'Liquidambar formosana', confidence: 0.3 }, null)
  check('needsGemini=false（≥閾值）', r.needsGemini, false)
}

console.log('\n[Case 8] 恰好在閾值下 (0.299) → 拒絕，Gemini fallback')
{
  const r = resolveSpecies({ species: 'Liquidambar formosana', confidence: 0.299 }, null)
  check('needsGemini=true（<閾值）', r.needsGemini, true)
}

console.log(`\n═══ 結果：${passed} 通過 ✅  ${failed} 失敗 ❌ ═══`)
if (failed > 0) process.exit(1)
