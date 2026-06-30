// reupload_trees.js
// 將 32 棵樹以修正後的 dbh_cm 重新上鏈，並更新 trees.tx_hash
'use strict';
require('dotenv').config({ path: '/home/yuchi/forest-carbon-measurement/.env' });

const Database = require('better-sqlite3');
const { recordMeasurement } = require('/home/yuchi/forest-carbon-measurement/src/services/blockchainService');

const DB_PATH = '/home/yuchi/forest-carbon-measurement/data.db';
const CORRECTION_FACTOR = 1.155;

async function main() {
  const db = new Database(DB_PATH);

  const trees = db.prepare(`
    SELECT id, dbh_cm, species, gps, volume_m3, carbon_kg, video_hash
    FROM trees
    WHERE tx_hash IS NOT NULL
    ORDER BY id
  `).all();

  console.log(`找到 ${trees.length} 棵樹，開始重新上鏈...`);

  let success = 0;
  let failed = 0;

  for (const tree of trees) {
    const originalDbhCm = tree.dbh_cm / CORRECTION_FACTOR;
    // video_hash 是 64 位 hex 字串，直接傳入（blockchainService 會取前 32 字元轉 bytes32）
    const videoHash = tree.video_hash || '';

    try {
      // recordMeasurement 已包含 await tx.wait()，直接回傳 receipt.hash
      const newTxHash = await recordMeasurement({
        gps: tree.gps || '',
        species: tree.species || '',
        dbhCm: tree.dbh_cm,
        volumeM3: tree.volume_m3 || 0,
        carbonKg: tree.carbon_kg || 0,
        videoHash: videoHash,
        treeId: 0,  // UUID 無法轉 BigInt，統一傳 0
        originalDbhCm: originalDbhCm,
        appliedCorrectionFactor: CORRECTION_FACTOR,
      });

      db.prepare('UPDATE trees SET tx_hash = ? WHERE id = ?').run(newTxHash, tree.id);

      success++;
      console.log(`[${success}/${trees.length}] 成功 id=${tree.id.substring(0,8)} dbh=${tree.dbh_cm}cm tx=${newTxHash.substring(0,20)}...`);

    } catch (err) {
      failed++;
      console.error(`[失敗] id=${tree.id.substring(0,8)} 錯誤：${err.message}`);
    }
  }

  db.close();
  console.log(`\n完成：成功 ${success} 棵，失敗 ${failed} 棵`);
}

main().catch(err => {
  console.error('腳本執行錯誤：', err.message);
  process.exit(1);
});
