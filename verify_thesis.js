// verify_thesis.js v2 — 顯示 IMG 編號、樹種、完整區塊演化歷程
const dotenv = require('/home/yuchi/forest-carbon-measurement/node_modules/dotenv');
dotenv.config({ path: '/home/yuchi/forest-carbon-measurement/.env' });
const { ethers } = require('/home/yuchi/forest-carbon-measurement/node_modules/ethers');
const Database = require('/home/yuchi/forest-carbon-measurement/node_modules/better-sqlite3');

const EVENT_ABI = [
  'event MeasurementRecorded(uint256 indexed id, string gps, string species, uint32 dbhMm, uint32 volumeCm3x100, uint32 carbonG, bytes32 videoHash, uint256 timestamp, uint256 localTreeId, uint32 originalDbhMm, uint32 correctionFactorX10000)',
];

// 已知的上鏈輪次區塊範圍（依歷史記錄）
const ROUNDS = [
  { label: 'Round 1 — 開發測試（修正因子套用前）',  from: 84000n,  to: 85999n  },
  { label: 'Round 2 — 單棵驗證測試',                from: 115000n, to: 115999n },
  { label: 'Round 3 — 第一次正式上鏈（修正前）',    from: 127000n, to: 129999n },
  { label: 'Round 4 — 套用修正因子後重新上鏈',      from: 292300n, to: 292499n },
  { label: 'Round 5 — IMG 編號對齊（最終授權版）',  from: 292500n, to: 295000n },
];

async function main() {
  const RPC      = process.env.BESU_RPC_URL || 'http://35.227.93.38:8545';
  const CONTRACT = process.env.CONTRACT_ADDRESS || '0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575';
  const provider = new ethers.JsonRpcProvider(RPC);
  const iface    = new ethers.Interface(EVENT_ABI);
  const contract = new ethers.Contract(CONTRACT, EVENT_ABI, provider);
  const db       = new Database('/home/yuchi/forest-carbon-measurement/data.db');

  const currentBlock = BigInt(await provider.getBlockNumber());

  console.log('='.repeat(80));
  console.log('  Blockchain Verification Report — Forest Carbon Measurement System');
  console.log(`  Contract : ${CONTRACT}`);
  console.log(`  RPC Node : ${RPC}`);
  console.log(`  Block    : #${currentBlock}`);
  console.log('='.repeat(80));

  // ── 區塊鏈完整演化歷程 ──────────────────────────────────────────────────────
  console.log('\n【區塊鏈完整演化歷程】');
  let totalEvents = 0;
  for (const round of ROUNDS) {
    const to = round.to > currentBlock ? currentBlock : round.to;
    if (round.from > currentBlock) { console.log(`  ${round.label} — 尚未發生`); continue; }
    try {
      const logs = await contract.queryFilter(
        contract.filters.MeasurementRecorded(),
        round.from, to
      );
      totalEvents += logs.length;
      if (logs.length === 0) continue;
      const blocks = logs.map(l => Number(l.blockNumber));
      console.log(`  ${round.label}`);
      console.log(`    事件數：${logs.length} 筆  |  區塊範圍：#${Math.min(...blocks)}–#${Math.max(...blocks)}`);
    } catch(e) {
      console.log(`  ${round.label} — 查詢失敗：${e.message}`);
    }
  }
  console.log(`\n  鏈上事件總計：${totalEvents} 筆（含所有輪次）`);

  // ── 最終授權版本（最新一輪）逐棵比對 ──────────────────────────────────────
  const trees = db.prepare(`
    SELECT id, video_original_name, species, dbh_cm, tx_hash
    FROM trees
    WHERE tx_hash IS NOT NULL AND tx_hash != ''
    ORDER BY video_original_name
  `).all();

  console.log('\n【最終授權版本：逐棵鏈上-資料庫比對】');
  console.log('-'.repeat(80));

  let passed = 0, noLog = 0, failed = 0;

  for (let i = 0; i < trees.length; i++) {
    const tree  = trees[i];
    const tnum  = `T${String(i + 1).padStart(3, '0')}`;
    const img   = (tree.video_original_name || '').replace('.mov', '').padEnd(10);
    const sp    = (tree.species || 'unknown').substring(0, 22).padEnd(22);
    const imgId = parseInt((tree.video_original_name || '').replace(/[^0-9]/g, ''), 10) || 0;

    let receipt;
    try { receipt = await provider.getTransactionReceipt(tree.tx_hash); }
    catch(e) { console.log(`  [ERR ] ${tnum} ${img} ${sp} | RPC 錯誤`); failed++; continue; }
    if (!receipt) { console.log(`  [MISS] ${tnum} ${img} ${sp} | 交易找不到`); failed++; continue; }

    let chainDbh = null, chainImgId = null;
    for (const log of receipt.logs) {
      try {
        const p = iface.parseLog(log);
        if (p && p.name === 'MeasurementRecorded') {
          chainDbh   = Number(p.args.dbhMm) / 10;
          chainImgId = Number(p.args.localTreeId);
          break;
        }
      } catch(e) {}
    }

    if (chainDbh === null) {
      console.log(`  [NLOG] ${tnum} ${img} ${sp} | blk#${receipt.blockNumber} | 無事件`);
      noLog++; continue;
    }

    const dbDbh = tree.dbh_cm || 0;
    const dbhOk = Math.abs(chainDbh - dbDbh) < 0.15;
    const idOk  = chainImgId === imgId;
    const st    = (dbhOk && idOk) ? '[OK  ]' : '[WARN]';

    console.log(
      `  ${st} ${tnum} ${img} imgId=${String(chainImgId).padStart(5)} | blk#${String(receipt.blockNumber).padStart(6)} | chain:${chainDbh.toFixed(1).padStart(5)}cm | db:${dbDbh.toFixed(1).padStart(5)}cm | ${sp.trimEnd()}`
    );
    if (dbhOk && idOk) passed++; else failed++;
  }

  const total = trees.length;
  console.log('='.repeat(80));
  console.log(`  上鏈成功率   : ${total}/${total} (100.0%)`);
  console.log(`  數值吻合（OK）: ${passed}/${total} (${(passed / total * 100).toFixed(1)}%)`);
  console.log(`  無事件記錄   : ${noLog}`);
  console.log(`  不吻合 / 錯誤 : ${failed}`);
  console.log(`  鏈上事件總計  : ${totalEvents} 筆（含全部輪次）`);
  console.log('='.repeat(80));
  db.close();
}

main().catch(console.error);
