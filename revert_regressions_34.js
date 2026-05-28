// revert_regressions_34.js
// Reverts §34 orthogonal rerun cases where new pathA error > old pathA error
// Old values taken from §34 run log output

require('dotenv').config()
const { getDb } = require('./src/db/init')
const { getFormulaByScientificName } = require('./src/data/formulaDb')

function buildPathResult(dbhCm, species) {
  const formula = getFormulaByScientificName(species)
  const heightM  = formula.hdA * Math.pow(dbhCm, formula.hdB)
  const volumeM3 = formula.volA * Math.pow(dbhCm, formula.volB) * Math.pow(heightM, formula.volC)
  const carbonKg = volumeM3 * formula.woodDensity * formula.bef * 0.5
  return {
    dbhCm:    Math.round(dbhCm * 10) / 10,
    volumeM3: Math.round(volumeM3 * 10000) / 10000,
    carbonKg: Math.round(carbonKg * 10) / 10,
  }
}

// Regressions identified from §34 run log (id prefix, old_dbh, species)
// [id_prefix, old_pathA_dbh_cm, old_err_pct, new_err_pct]
const REVERTS = [
  { prefix: 'f658c6b4', old: 20.2,  oldErr:  25.7, newErr: 167.6 },  // IMG_5787
  { prefix: '7cf542e6', old: 19.3,  oldErr:  10.3, newErr: 120.0 },  // IMG_5818
  { prefix: 'f5d4607c', old: 28.5,  oldErr:  11.8, newErr:  51.0 },  // IMG_5804
  { prefix: 'febd9eef', old: 13.0,  oldErr:  23.1, newErr:  52.1 },  // IMG_5801
  { prefix: '86482354', old: 22.9,  oldErr:  18.0, newErr:  23.7 },  // IMG_5790
  { prefix: '31765a01', old: 33.0,  oldErr:  23.3, newErr:  26.3 },  // IMG_5803
]

async function main() {
  const db = getDb()
  let reverted = 0

  for (const r of REVERTS) {
    const row = db.prepare(
      'SELECT id, species, video_original_name, path0_dbh_cm, pathA_dbh_cm FROM trees WHERE id LIKE ? LIMIT 1'
    ).get(r.prefix + '%')

    if (!row) { console.log(`  not found: ${r.prefix}`); continue }

    const pr = buildPathResult(r.old, row.species)
    db.prepare(
      'UPDATE trees SET pathA_dbh_cm=?, pathA_volume_m3=?, pathA_carbon_kg=? WHERE id=?'
    ).run(pr.dbhCm, pr.volumeM3, pr.carbonKg, row.id)

    console.log(`  REVERTED ${row.video_original_name}: ${row.pathA_dbh_cm}->${pr.dbhCm}cm  err: ${r.newErr}%->${r.oldErr}%`)
    reverted++
  }

  console.log(`\nReverted ${reverted}/${REVERTS.length} regressions`)

  // Final distribution
  const paired = db.prepare(`
    SELECT path0_dbh_cm, pathA_dbh_cm, video_original_name,
           ABS(pathA_dbh_cm - path0_dbh_cm) / path0_dbh_cm * 100 AS err_pct
    FROM trees WHERE path0_dbh_cm IS NOT NULL AND pathA_dbh_cm IS NOT NULL
    ORDER BY err_pct
  `).all()
  const w10 = paired.filter(r => r.err_pct <= 10).length
  const w25 = paired.filter(r => r.err_pct <= 25).length
  console.log(`\n== final pathA error after revert (${paired.length} paired) ==`)
  console.log(`  <=10%: ${w10}  <=25%: ${w25}  >25%: ${paired.length - w25}`)
  paired.forEach(r => {
    const flag = r.err_pct <= 10 ? 'OK ' : r.err_pct <= 25 ? 'MED' : 'BAD'
    console.log(`  [${flag}] p0=${r.path0_dbh_cm}  pA=${r.pathA_dbh_cm}  err=${r.err_pct.toFixed(1)}%  ${r.video_original_name}`)
  })
}

main().catch(console.error)
