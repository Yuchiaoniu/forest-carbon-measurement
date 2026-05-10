require('dotenv').config()
const { ethers } = require('ethers')
const fs = require('fs')
const path = require('path')

// ABI 與 bytecode（solc 編譯輸出）
// 為簡化部署流程，使用預編譯的 ABI + bytecode
const ABI = [
  'constructor()',
  'function recordMeasurement(string gps, string species, uint32 dbhMm, uint32 volumeCm3x100, uint32 carbonG, bytes32 videoHash) returns (uint256)',
  'function getMeasurement(uint256 id) view returns (tuple(string gps, string species, uint32 dbhMm, uint32 volumeCm3x100, uint32 carbonG, bytes32 videoHash, uint256 timestamp))',
  'function measurementCount() view returns (uint256)',
  'event MeasurementRecorded(uint256 indexed id, string gps, string species, uint32 dbhMm, uint32 carbonG, bytes32 videoHash, uint256 timestamp)',
]

// Bytecode（需先用 solc 編譯 CarbonCredit.sol）
// 執行：npx solc --bin --abi contracts/CarbonCredit.sol -o artifacts/
// 或使用 Hardhat：npx hardhat compile
const BYTECODE_PATH = path.join(__dirname, '../artifacts/CarbonCredit.bin')

async function main() {
  if (!fs.existsSync(BYTECODE_PATH)) {
    console.log('❌ 找不到 artifacts/CarbonCredit.bin')
    console.log('   請先執行：npx hardhat compile 或 npx solc --bin contracts/CarbonCredit.sol -o artifacts/')
    process.exit(1)
  }

  const bytecode = '0x' + fs.readFileSync(BYTECODE_PATH, 'utf8').trim()
  const provider = new ethers.JsonRpcProvider(process.env.BESU_RPC_URL)
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider)

  console.log(`🔗 連接節點：${process.env.BESU_RPC_URL}`)
  console.log(`💼 部署帳號：${wallet.address}`)

  const factory = new ethers.ContractFactory(ABI, bytecode, wallet)
  const contract = await factory.deploy()
  await contract.waitForDeployment()

  const address = await contract.getAddress()
  console.log(`✅ 合約已部署：${address}`)

  // 自動寫入 .env
  const envPath = path.join(__dirname, '../.env')
  let env = fs.readFileSync(envPath, 'utf8')
  env = env.replace(/^CONTRACT_ADDRESS=.*$/m, `CONTRACT_ADDRESS=${address}`)
  fs.writeFileSync(envPath, env)
  console.log(`📝 CONTRACT_ADDRESS 已寫入 .env`)
}

main().catch(e => { console.error(e); process.exit(1) })
