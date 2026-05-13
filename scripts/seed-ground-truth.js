require('dotenv').config()
const { getDb } = require('../src/db/init')
const { insert } = require('../src/db/groundTruth')

const db = getDb()
const tree = db.prepare(
  "SELECT id, dbh_cm FROM trees WHERE species = 'Ficus microcarpa' LIMIT 1"
).get()

if (!tree) {
  console.log('找不到 Ficus microcarpa，改用第一筆記錄')
  const first = db.prepare('SELECT id, dbh_cm, species FROM trees LIMIT 1').get()
  if (!first) { console.log('資料庫無任何記錄'); process.exit(1) }
  console.log(`使用：${first.species} id=${first.id} dbh=${first.dbh_cm}`)
  const actuals = [
    first.dbh_cm * 0.82, first.dbh_cm * 0.85,
    first.dbh_cm * 0.80, first.dbh_cm * 0.83, first.dbh_cm * 0.81
  ].map(v => Math.round(v * 10) / 10)
  actuals.forEach(actual => {
    const r = insert({ treeId: first.id, actualDbhCm: actual, estimatedDbhCm: first.dbh_cm, source: 'manual' })
    console.log(`  actual=${actual}cm factor=${r.correctionFactor}`)
  })
  process.exit(0)
}

console.log(`找到 Ficus microcarpa id=${tree.id} dbh=${tree.dbh_cm}cm`)
const actuals = [75, 78, 72, 76, 74]
actuals.forEach(actual => {
  const r = insert({ treeId: tree.id, actualDbhCm: actual, estimatedDbhCm: tree.dbh_cm, source: 'manual' })
  console.log(`  actual=${actual}cm factor=${r.correctionFactor}`)
})
console.log('完成！')
