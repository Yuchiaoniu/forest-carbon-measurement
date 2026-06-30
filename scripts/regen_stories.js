/**
 * regen_stories.js — 重新生成所有樹木的方案 A 故事（§28.8 升級版 prompt）
 * 用法：cd ~/forest-carbon-measurement && node scripts/regen_stories.js
 * 不刪舊故事，直接 INSERT 新版；getLatestByTree ORDER BY created_at DESC，
 * 新版會自動成為端點回傳的版本。
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const { getDb } = require('../src/db/init')
const { generateStoryA } = require('../src/services/storyService')
const { insert: insertStory } = require('../src/db/stories')

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const trees = getDb().prepare(
    `SELECT id, species FROM trees WHERE winner_path IS NOT NULL ORDER BY created_at ASC`
  ).all()

  console.log(`[regen] 共 ${trees.length} 棵樹，開始重新生成故事…`)

  let ok = 0, fail = 0, skip = 0

  for (let i = 0; i < trees.length; i++) {
    const tree = trees[i]
    const label = `[${i + 1}/${trees.length}] ${tree.id.slice(0, 8)} (${tree.species})`
    process.stdout.write(`${label} … `)

    try {
      const storyA = await generateStoryA(tree.id)
      if (!storyA) {
        console.log('SKIP (no result)')
        skip++
        continue
      }
      insertStory({
        treeId: tree.id,
        storyType: 'A',
        markdown: storyA.markdown,
        summary: storyA.summary,
        weatherSnapshot: storyA.weather,
      })
      console.log('✓')
      ok++
    } catch (e) {
      console.log(`✗ ${e.message}`)
      fail++
    }

    // 間隔 3 秒避免 Gemini rate limit
    if (i < trees.length - 1) await sleep(3000)
  }

  console.log(`\n[regen] 完成：成功 ${ok}、跳過 ${skip}、失敗 ${fail}`)
}

main().catch(e => { console.error('[regen] fatal:', e.message); process.exit(1) })
