const { ethers } = require('ethers')

const ABI = [
  'function recordMeasurement(string gps, string species, uint32 dbhMm, uint32 volumeCm3x100, uint32 carbonG, bytes32 videoHash) returns (uint256)',
  'function getMeasurement(uint256 id) view returns (tuple(string gps, string species, uint32 dbhMm, uint32 volumeCm3x100, uint32 carbonG, bytes32 videoHash, uint256 timestamp))',
  'event MeasurementRecorded(uint256 indexed id, string gps, string species, uint32 dbhMm, uint32 carbonG, bytes32 videoHash, uint256 timestamp)',
]

let contract

function getContract() {
  if (!contract) {
    const provider = new ethers.JsonRpcProvider(process.env.BESU_RPC_URL)
    const wallet = new ethers.Wallet(process.env.SIGNER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY, provider)
    contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ABI, wallet)
  }
  return contract
}

async function recordMeasurement({ gps, species, dbhCm, volumeM3, carbonKg, videoHash }) {
  const c = getContract()
  const dbhMm = Math.round(dbhCm * 10)
  const volumeCm3x100 = Math.round(volumeM3 * 1e6)
  const carbonG = Math.round(carbonKg * 1000)
  const hashBytes = ethers.hexlify(ethers.toUtf8Bytes(videoHash)).padEnd(66, '0').slice(0, 66)

  const tx = await c.recordMeasurement(
    gps || '', species || 'unknown',
    dbhMm, volumeCm3x100, carbonG,
    ethers.zeroPadBytes(ethers.toUtf8Bytes(videoHash.slice(0, 32)), 32)
  )
  const receipt = await tx.wait()
  return receipt.hash
}

module.exports = { recordMeasurement }
