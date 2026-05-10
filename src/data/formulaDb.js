// 台灣林業局樹種材積公式係數
// 材積 V (m³) = a × DBH^b × H^c（通用形式）
// 樹高 H (m) 由 H-D 關係式估算：H = a × DBH^b
// 碳儲量 (kg C) = V × 木材密度(kg/m³) × 生物量擴展係數 × 0.5

const SPECIES_DB = {
  // 學名 -> 資料
  'Cinnamomum camphora': {
    zhName: '樟樹',
    // H-D 關係：H = 4.2 × DBH^0.55（DBH in cm，H in m）
    hdA: 4.2, hdB: 0.55,
    // 材積公式 V = 0.00005 × DBH^1.9 × H^0.9
    volA: 0.00005, volB: 1.9, volC: 0.9,
    woodDensity: 560,  // kg/m³
    bef: 1.3,          // 生物量擴展係數
  },
  'Cryptomeria japonica': {
    zhName: '柳杉',
    hdA: 5.1, hdB: 0.52,
    volA: 0.000045, volB: 1.95, volC: 0.85,
    woodDensity: 380, bef: 1.25,
  },
  'Taiwania cryptomerioides': {
    zhName: '台灣杉',
    hdA: 5.8, hdB: 0.50,
    volA: 0.000048, volB: 1.92, volC: 0.88,
    woodDensity: 430, bef: 1.28,
  },
  'Acacia confusa': {
    zhName: '相思樹',
    hdA: 3.8, hdB: 0.58,
    volA: 0.000055, volB: 1.85, volC: 0.92,
    woodDensity: 700, bef: 1.35,
  },
  'Liquidambar formosana': {
    zhName: '楓香',
    hdA: 4.5, hdB: 0.53,
    volA: 0.000052, volB: 1.88, volC: 0.90,
    woodDensity: 520, bef: 1.30,
  },
  'Fraxinus griffithii': {
    zhName: '光臘樹',
    hdA: 4.0, hdB: 0.56,
    volA: 0.000050, volB: 1.90, volC: 0.90,
    woodDensity: 600, bef: 1.32,
  },
  'Casuarina equisetifolia': {
    zhName: '木麻黃',
    hdA: 4.8, hdB: 0.51,
    volA: 0.000046, volB: 1.93, volC: 0.87,
    woodDensity: 850, bef: 1.20,
  },
}

const DEFAULT_FORMULA = {
  zhName: '未知樹種',
  hdA: 4.0, hdB: 0.55,
  volA: 0.000050, volB: 1.90, volC: 0.90,
  woodDensity: 500, bef: 1.30,
  isDefault: true,
}

const ZH_NAME_MAP = {}
Object.entries(SPECIES_DB).forEach(([sci, data]) => {
  ZH_NAME_MAP[data.zhName] = sci
})

function getFormulaByScientificName(scientificName) {
  if (!scientificName) return { ...DEFAULT_FORMULA }
  // 直接比對
  if (SPECIES_DB[scientificName]) return { ...SPECIES_DB[scientificName], isDefault: false }
  // 部分比對（Gemini 可能回傳不完整學名）
  const key = Object.keys(SPECIES_DB).find(k =>
    scientificName.toLowerCase().includes(k.split(' ')[0].toLowerCase())
  )
  return key ? { ...SPECIES_DB[key], isDefault: false } : { ...DEFAULT_FORMULA }
}

function getFormulaByZhName(zhName) {
  const sci = ZH_NAME_MAP[zhName]
  return sci ? { ...SPECIES_DB[sci], isDefault: false } : { ...DEFAULT_FORMULA }
}

function getSupportedSpecies() {
  return Object.entries(SPECIES_DB).map(([sci, d]) => ({ scientific: sci, zh: d.zhName }))
}

module.exports = { getFormulaByScientificName, getFormulaByZhName, getSupportedSpecies }
