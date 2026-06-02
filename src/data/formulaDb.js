// 台灣林業局樹種材積公式係數
// 材積 V (m³) = a × DBH^b × H^c（通用形式）
// 樹高 H (m) 由 H-D 關係式估算：H = a × DBH^b
// 碳儲量 (kg C) = V × 木材密度(kg/m³) × 生物量擴展係數 × 0.5
//
// sourceNote 說明：
//   official   = 台灣林業局官方公式
//   approx-broadleaf  = 依 Global Wood Density Database 木材密度 + 同科樹種 H-D/材積通式推算
//   approx-pioneer    = 同上，但為先驅快生樹種（木材較輕、BEF 較高）

const SPECIES_DB = {
  // ── 官方資料（台灣林業局）──────────────────────────────────────────
  'Cinnamomum camphora': {
    zhName: '樟樹',
    hdA: 4.2, hdB: 0.55,
    volA: 0.00005, volB: 1.9, volC: 0.9,
    woodDensity: 560, bef: 1.3,
    sourceNote: 'official',
  },
  'Cryptomeria japonica': {
    zhName: '柳杉',
    hdA: 5.1, hdB: 0.52,
    volA: 0.000045, volB: 1.95, volC: 0.85,
    woodDensity: 380, bef: 1.25,
    sourceNote: 'official',
  },
  'Taiwania cryptomerioides': {
    zhName: '台灣杉',
    hdA: 5.8, hdB: 0.50,
    volA: 0.000048, volB: 1.92, volC: 0.88,
    woodDensity: 430, bef: 1.28,
    sourceNote: 'official',
  },
  'Acacia confusa': {
    zhName: '相思樹',
    hdA: 3.8, hdB: 0.58,
    volA: 0.000055, volB: 1.85, volC: 0.92,
    woodDensity: 700, bef: 1.35,
    sourceNote: 'official',
  },
  'Liquidambar formosana': {
    zhName: '楓香',
    hdA: 4.5, hdB: 0.53,
    volA: 0.000052, volB: 1.88, volC: 0.90,
    woodDensity: 520, bef: 1.30,
    sourceNote: 'official',
  },
  'Fraxinus griffithii': {
    zhName: '光臘樹',
    hdA: 4.0, hdB: 0.56,
    volA: 0.000050, volB: 1.90, volC: 0.90,
    woodDensity: 600, bef: 1.32,
    sourceNote: 'official',
  },
  'Casuarina equisetifolia': {
    zhName: '木麻黃',
    hdA: 4.8, hdB: 0.51,
    volA: 0.000046, volB: 1.93, volC: 0.87,
    woodDensity: 850, bef: 1.20,
    sourceNote: 'official',
  },

  // ── 補充樹種（推算值，供碳匯估算使用）────────────────────────────────
  // 係數依 Global Wood Density Database（Chave et al. 2009）木材密度，
  // H-D 與材積通式依同科樹種推算，非台灣林業局官方數據。
  // 論文引用時請標注此限制。

  'Terminalia catappa': {
    zhName: '欖仁樹',
    // 低海拔熱帶常見，樹形開展，中等高度
    hdA: 3.5, hdB: 0.57,
    volA: 0.000053, volB: 1.88, volC: 0.90,
    woodDensity: 480, bef: 1.30,
    sourceNote: 'approx-broadleaf',
  },
  'Melia azedarach': {
    zhName: '苦楝',
    hdA: 3.8, hdB: 0.57,
    volA: 0.000050, volB: 1.90, volC: 0.90,
    woodDensity: 490, bef: 1.30,
    sourceNote: 'approx-broadleaf',
  },
  'Toona ciliata': {
    zhName: '香椿',
    hdA: 4.5, hdB: 0.52,
    volA: 0.000048, volB: 1.92, volC: 0.88,
    woodDensity: 450, bef: 1.28,
    sourceNote: 'approx-broadleaf',
  },
  'Swietenia macrophylla': {
    zhName: '大葉桃花心木',
    hdA: 5.0, hdB: 0.50,
    volA: 0.000048, volB: 1.92, volC: 0.88,
    woodDensity: 600, bef: 1.28,
    sourceNote: 'approx-broadleaf',
  },
  'Zelkova serrata': {
    zhName: '櫸木',
    hdA: 4.2, hdB: 0.55,
    volA: 0.000050, volB: 1.90, volC: 0.90,
    woodDensity: 700, bef: 1.35,
    sourceNote: 'approx-broadleaf',
  },
  'Koelreuteria elegans': {
    zhName: '台灣欒樹',
    hdA: 3.8, hdB: 0.57,
    volA: 0.000050, volB: 1.90, volC: 0.90,
    woodDensity: 490, bef: 1.30,
    sourceNote: 'approx-broadleaf',
  },
  'Celtis sinensis': {
    zhName: '朴樹',
    hdA: 4.0, hdB: 0.55,
    volA: 0.000050, volB: 1.90, volC: 0.90,
    woodDensity: 580, bef: 1.32,
    sourceNote: 'approx-broadleaf',
  },
  'Albizia lebbeck': {
    zhName: '大葉合歡',
    hdA: 4.5, hdB: 0.53,
    volA: 0.000050, volB: 1.90, volC: 0.90,
    woodDensity: 600, bef: 1.30,
    sourceNote: 'approx-broadleaf',
  },
  'Macaranga tanarius': {
    zhName: '血桐',
    // 先驅快生種，木材較輕
    hdA: 3.0, hdB: 0.60,
    volA: 0.000055, volB: 1.87, volC: 0.93,
    woodDensity: 350, bef: 1.40,
    sourceNote: 'approx-pioneer',
  },
  'Sapindus saponaria': {
    zhName: '無患子',
    hdA: 4.0, hdB: 0.55,
    volA: 0.000050, volB: 1.90, volC: 0.90,
    woodDensity: 620, bef: 1.30,
    sourceNote: 'approx-broadleaf',
  },
  'Sapindus mukorossi': {
    zhName: '無患子',
    hdA: 4.0, hdB: 0.55,
    volA: 0.000050, volB: 1.90, volC: 0.90,
    woodDensity: 620, bef: 1.30,
    sourceNote: 'approx-broadleaf',
  },
  'Robinia pseudoacacia': {
    zhName: '刺槐',
    hdA: 5.0, hdB: 0.50,
    volA: 0.000048, volB: 1.92, volC: 0.88,
    woodDensity: 750, bef: 1.25,
    sourceNote: 'approx-broadleaf',
  },
  'Thespesia populnea': {
    zhName: '繖楊',
    hdA: 4.0, hdB: 0.56,
    volA: 0.000050, volB: 1.90, volC: 0.90,
    woodDensity: 620, bef: 1.30,
    sourceNote: 'approx-broadleaf',
  },
  'Liquidambar styraciflua': {
    zhName: '美洲楓香',
    // 與台灣楓香（L. formosana）同屬，係數近似
    hdA: 4.5, hdB: 0.53,
    volA: 0.000052, volB: 1.88, volC: 0.90,
    woodDensity: 500, bef: 1.28,
    sourceNote: 'approx-broadleaf',
  },
  'Azadirachta indica': {
    zhName: '印度楝',
    hdA: 4.2, hdB: 0.54,
    volA: 0.000050, volB: 1.90, volC: 0.90,
    woodDensity: 620, bef: 1.28,
    sourceNote: 'approx-broadleaf',
  },

  // ── Pl@ntNet 回傳樹種（補充）──────────────────────────────────────────
  // Camphora officinarum = Cinnamomum camphora 異名（APG IV 分類調整）
  'Camphora officinarum': {
    zhName: '樟樹',
    hdA: 4.2, hdB: 0.55,
    volA: 0.00005, volB: 1.9, volC: 0.9,
    woodDensity: 560, bef: 1.3,
    sourceNote: 'official',  // 同 Cinnamomum camphora
  },
  'Calophyllum inophyllum': {
    zhName: '瓊崖海棠',
    // 低海拔熱帶硬木，沿海常見
    hdA: 3.8, hdB: 0.56,
    volA: 0.000050, volB: 1.90, volC: 0.90,
    woodDensity: 720, bef: 1.28,
    sourceNote: 'approx-broadleaf',
  },
  'Cedrela odorata': {
    zhName: '西班牙雪松',
    // Meliaceae 科，與苦楝同科，木材中輕
    hdA: 4.8, hdB: 0.52,
    volA: 0.000048, volB: 1.92, volC: 0.88,
    woodDensity: 450, bef: 1.28,
    sourceNote: 'approx-broadleaf',
  },
  'Bischofia javanica': {
    zhName: '茄苳',
    // 台灣低海拔常見闊葉樹，木材中重
    hdA: 4.0, hdB: 0.55,
    volA: 0.000050, volB: 1.90, volC: 0.90,
    woodDensity: 670, bef: 1.32,
    sourceNote: 'approx-broadleaf',
  },
  'Carya illinoinensis': {
    zhName: '美洲山核桃',
    // Juglandaceae 科，硬木
    hdA: 4.5, hdB: 0.53,
    volA: 0.000048, volB: 1.92, volC: 0.88,
    woodDensity: 700, bef: 1.25,
    sourceNote: 'approx-broadleaf',
  },
  'Pongamia pinnata': {
    zhName: '水黃皮',
    // 台灣海岸固氮樹種，中等木材密度
    hdA: 3.8, hdB: 0.57,
    volA: 0.000050, volB: 1.90, volC: 0.90,
    woodDensity: 620, bef: 1.30,
    sourceNote: 'approx-broadleaf',
  },
  'Salix pentandra': {
    zhName: '五蕊柳',
    // 柳屬，快生輕木
    hdA: 3.5, hdB: 0.58,
    volA: 0.000053, volB: 1.87, volC: 0.92,
    woodDensity: 430, bef: 1.35,
    sourceNote: 'approx-broadleaf',
  },
  'Styphnolobium japonicum': {
    zhName: '槐樹',
    // 豆科，中重硬木
    hdA: 4.2, hdB: 0.54,
    volA: 0.000050, volB: 1.90, volC: 0.90,
    woodDensity: 650, bef: 1.28,
    sourceNote: 'approx-broadleaf',
  },
  // Swietenia mahagoni = 小葉桃花心木，同屬 Swietenia，係數近似 S. macrophylla
  'Swietenia mahagoni': {
    zhName: '小葉桃花心木',
    hdA: 5.0, hdB: 0.50,
    volA: 0.000048, volB: 1.92, volC: 0.88,
    woodDensity: 640, bef: 1.28,
    sourceNote: 'approx-broadleaf',
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
