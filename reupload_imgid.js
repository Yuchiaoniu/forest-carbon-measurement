// reupload_imgid.js
// 以 IMG 編號（如 5786）作為 localTreeId 第三次重新上鏈，建立可追溯的對應關係
'use strict';
require('dotenv').config({ path: '/home/yuchi/forest-carbon-measurement/.env' });

const Database = require('better-sqlite3');
const { recordMeasurement } = require('/home/yuchi/forest-carbon-measurement/src/services/blockchainService');

const DB_PATH = '/home/yuchi/forest-carbon-measurement/data.db';
const CORRECTION_FACTOR = 1.155;

async function main() {
  const db = new Database(DB_PATH);

  const trees = db.prepare(`
    SELECT id, video_original_name, dbh_cm, species, gps, volume_m3, carbon_kg, video_hash
    FROM trees
    WHERE tx_hash IS NOT NULL
    ORDER BY video_original_name
  `).all();

  console.log(`找到 ${trees.length} 棵樹，以 IMG 編號作為 localTreeId 重新上鏈...`);

  let success = 0, failed = 0;

  for (const tree of trees) {
    // 從影片檔名萃取整數編號：IMG_5786.mov → 5786
    const imgNum = parseInt((tree.video_original_name || '').replace(/[^0-9]/g, ''), 10) || 0;
    const label = tree.video_original_name || '(unknown)';
    const originalDbhCm = tree.dbh_cm / CORRECTION_FACTOR;

    try {
      const newTxHash = await recordMeasurement({
        gps: tree.gps || '',
        species: tree.species || '',
        dbhCm: tree.dbh_cm,
        volumeM3: tree.volume_m3 || 0,
        carbonKg: tree.carbon_kg || 0,
        videoHash: tree.video_hash || '',
        treeId: imgNum,
        originalDbhCm: originalDbhCm,
        appliedCorrectionFactor: CORRECTION_FACTOR,
      });

      db.prepare('UPDATE trees SET tx_hash = ? WHERE id = ?').run(newTxHash, tree.id);

      success++;
      console.log(`[${String(success).padStart(2)}/${trees.length}] ${label.padEnd(16)} imgId=${imgNum} dbh=${tree.dbh_cm}cm tx=${newTxHash.substring(0,20)}...`);

    } catch (err) {
      failed++;
      console.error(`[失敗] ${label} 錯誤：${err.message}`);
    }
  }

  db.close();
  console.log(`\n完成：成功 ${success} 棵，失敗 ${failed} 棵`);
}

main().catch(err => {
  console.error('腳本執行錯誤：', err.message);
  process.exit(1);
});
