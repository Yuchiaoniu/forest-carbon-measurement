require('dotenv').config()
const { ethers } = require('ethers')
const solc = require('solc')
const fs = require('fs')
const path = require('path')

async function main() {
  console.log('📦 編譯 CarbonCredit.sol...')

  const source = fs.readFileSync(
    path.join(__dirname, '../contracts/CarbonCredit.sol'), 'utf8'
  )

  const input = {
    language: 'Solidity',
    sources: { 'CarbonCredit.sol': { content: source } },
    settings: {
      evmVersion: 'paris',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
    },
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input)))

  if (output.errors?.some(e => e.severity === 'error')) {
    console.error('❌ 編譯錯誤：', output.errors)
    process.exit(1)
  }

  const contract = output.contracts['CarbonCredit.sol']['CarbonCredit']
  const abi = contract.abi
  const bytecode = '0x' + contract.evm.bytecode.object

  console.log('✅ 編譯成功')
  console.log(`🔗 連接節點：${process.env.BESU_RPC_URL}`)

  const provider = new ethers.JsonRpcProvider(process.env.BESU_RPC_URL)
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider)

  console.log(`💼 部署帳號：${wallet.address}`)

  const balance = await provider.getBalance(wallet.address)
  console.log(`💰 餘額：${ethers.formatEther(balance)} ETH`)

  const factory = new ethers.ContractFactory(abi, bytecode, wallet)
  console.log('🚀 部署中...')

  const deployedContract = await factory.deploy({
    gasLimit: 6000000,
    gasPrice: 0,
  })
  await deployedContract.waitForDeployment()

  const address = await deployedContract.getAddress()
  console.log(`✅ 合約已部署：${address}`)

  // 自動寫入 .env
  const envPath = path.join(__dirname, '../.env')
  let env = fs.readFileSync(envPath, 'utf8')
  env = env.replace(/^CONTRACT_ADDRESS=.*$/m, `CONTRACT_ADDRESS=${address}`)
  fs.writeFileSync(envPath, env)
  console.log('📝 CONTRACT_ADDRESS 已寫入 .env')
  console.log('\n🌲 完成！現在可以執行 npm start 啟動系統。')
}

main().catch(e => { console.error(e.message); process.exit(1) })
