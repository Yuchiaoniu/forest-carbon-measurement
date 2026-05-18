// 台灣造林樹種生態多樣性資料庫
// 資料來源：林業試驗所、特有生物研究保育中心、農業部林業及自然保育署

const ECOLOGY_DB = {
  'Cinnamomum camphora': {
    zhName: '樟樹',
    origin: 'native',
    canopyLayer: 'canopy',
    habitatType: 'lowland',
    biodiversityScore: 5,
    keystone: true,
    birds: ['紅嘴黑鵯', '台灣藍鵲', '白頭翁', '大冠鷲', '灰頭椋鳥', '樹鵲'],
    insects: ['台灣黃斑蛺蝶', '樟蠶蛾', '獨角仙', '台灣大鍬形蟲', '台灣長臂金龜'],
    mammals: ['台灣獼猴', '白鼻心'],
    soilRole: '深根系穩固坡面，樟腦揮發物抑制病原菌，落葉腐植質富含有機氮',
    ecologicalRole: '台灣低海拔闊葉林的優勢樹種，樟腦化合物為多種昆蟲提供化學信號，成熟黑色核果是紅嘴黑鵯、台灣藍鵲的主要食源，粗獷樹皮與老樹洞提供猛禽及夜棲動物巢位，被列為台灣「國樹候選」之一',
    flowerSeason: '3–5 月',
    nectarBearing: true,
    fruiting: true,
    estimatedYearsToMature: 30,
    conservationNote: '台灣本島原生，低海拔次生林重要先鋒樹種',
  },

  'Cryptomeria japonica': {
    zhName: '柳杉',
    origin: 'introduced',
    canopyLayer: 'emergent',
    habitatType: 'montane',
    biodiversityScore: 2,
    keystone: false,
    birds: ['煤山雀', '冠羽畫眉', '台灣樹鶯'],
    insects: ['柳杉大痣小蜂', '雲杉天牛', '柳杉毛蟲'],
    mammals: ['台灣飛鼠'],
    soilRole: '落針酸化土壤，林冠密閉抑制下層植被，適合水土保持但生物多樣性較低',
    ecologicalRole: '日治時期大量引入的人工林樹種，密植單一林相使林下生物多樣性偏低；惟高大樹冠提供猛禽瞭望台，枯立木成為大型啄木鳥覓食棲地。混植闊葉樹可提升生態效益',
    flowerSeason: '2–3 月（花粉期）',
    nectarBearing: false,
    fruiting: false,
    estimatedYearsToMature: 20,
    conservationNote: '外來引進樹種，人工林主力但建議混植本土闊葉樹增加多樣性',
  },

  'Taiwania cryptomerioides': {
    zhName: '台灣杉',
    origin: 'native',
    canopyLayer: 'emergent',
    habitatType: 'montane',
    biodiversityScore: 4,
    keystone: false,
    birds: ['熊鷹', '台灣噪眉', '火冠戴菊鳥'],
    insects: ['台灣深山鍬形蟲', '台灣角胸鍬形蟲'],
    mammals: ['台灣黑熊', '台灣飛鼠'],
    soilRole: '根系深廣，林床維持濕潤微氣候，枯立木分解緩慢提供長期棲地',
    ecologicalRole: '台灣特有種，全球最高針葉樹之一（最高紀錄逾 80 公尺），為中海拔珍貴林木；雄偉樹幹是熊鷹在台灣最重要的繁殖棲地之一，老樹洞與斷枝是台灣飛鼠的主要夜宿場所',
    flowerSeason: '3–4 月',
    nectarBearing: false,
    fruiting: false,
    estimatedYearsToMature: 50,
    conservationNote: '台灣特有種，林業署保護木，具高度保育價值',
  },

  'Acacia confusa': {
    zhName: '相思樹',
    origin: 'native',
    canopyLayer: 'canopy',
    habitatType: 'lowland',
    biodiversityScore: 3,
    keystone: false,
    birds: ['白頭翁', '斑鳩', '五色鳥', '紅嘴黑鵯'],
    insects: ['小黃斑蛺蝶', '台灣白紋鳳蝶', '蜜蜂科（多種）', '木棉蚜蟲天敵群'],
    mammals: ['台灣獼猴'],
    soilRole: '根瘤菌固氮（每年每公頃可固氮 30–60 kg），改善貧瘠土壤，是台灣低海拔崩塌地最重要的先鋒樹種',
    ecologicalRole: '台灣低海拔最常見的先鋒闊葉樹，固氮能力是裸地生態復育的關鍵。金黃色球狀花序盛開期是蜜蜂的重要蜜源，漿果吸引五色鳥等中型鳥類，深根系有效穩定坡地',
    flowerSeason: '3–5 月',
    nectarBearing: true,
    fruiting: true,
    estimatedYearsToMature: 15,
    conservationNote: '台灣原生，崩塌地與貧瘠地復育首選，固氮先鋒樹種',
  },

  'Liquidambar formosana': {
    zhName: '楓香',
    origin: 'native',
    canopyLayer: 'canopy',
    habitatType: 'lowland',
    biodiversityScore: 4,
    keystone: false,
    birds: ['台灣藍鵲', '冠羽畫眉', '台灣山鷓鴣', '白耳畫眉'],
    insects: ['大紫蛺蝶', '枯葉蛺蝶', '楓天牛', '多種造癭蜂'],
    mammals: ['台灣獼猴', '赤腹松鼠'],
    soilRole: '秋季落葉量大，腐植質豐富，提升表土有機碳含量，落葉層是多種無脊椎動物的庇護所',
    ecologicalRole: '台灣低中海拔重要的季節性樹種，秋冬變紅色葉片是低海拔闊葉林景觀指標。帶刺蒴果提供台灣獼猴及松鼠的食源，大型樹冠成為猛禽的瞭望棲位，多種天牛幼蟲以樹幹為食，間接維繫啄木鳥族群',
    flowerSeason: '3–4 月',
    nectarBearing: false,
    fruiting: true,
    estimatedYearsToMature: 20,
    conservationNote: '台灣原生，闊葉林重要伴生樹種，秋冬變色景觀樹',
  },

  'Fraxinus griffithii': {
    zhName: '光臘樹',
    origin: 'native',
    canopyLayer: 'canopy',
    habitatType: 'lowland',
    biodiversityScore: 5,
    keystone: true,
    birds: ['台灣藍鵲', '白頭翁', '五色鳥', '紅頭山雀'],
    insects: ['台灣長臂金龜（二級保育類）', '獨角仙', '台灣大鍬形蟲', '深山锹形蟲'],
    mammals: ['台灣獼猴', '台灣野豬'],
    soilRole: '樹液分解吸引真菌，促進腐植質循環，林下有機質積累顯著',
    ecologicalRole: '台灣低海拔的「生態熱點」樹種，樹幹傷口滲出的樹液是台灣長臂金龜（保育二級）、獨角仙、鍬形蟲等甲蟲夏季最重要的食物來源。單株光臘樹在夏夜可吸引超過百隻甲蟲聚集，是台灣最具代表性的甲蟲寄主植物',
    flowerSeason: '4–6 月',
    nectarBearing: true,
    fruiting: true,
    estimatedYearsToMature: 15,
    conservationNote: '台灣原生，台灣長臂金龜指標棲地植物，具高生態保育優先性',
  },

  'Casuarina equisetifolia': {
    zhName: '木麻黃',
    origin: 'introduced',
    canopyLayer: 'emergent',
    habitatType: 'coastal',
    biodiversityScore: 2,
    keystone: false,
    birds: ['黑翅鳶', '燕鴴', '磯鷸'],
    insects: ['木麻黃毒蛾', '白痣大蚊'],
    mammals: [],
    soilRole: '根部共生放線菌固氮，防風定砂，但枯落物累積使土壤趨向酸性，抑制本土植物萌發',
    ecologicalRole: '早期大量種植於台灣西部海岸防風定砂，耐鹽耐旱性強。然而其枯落物化感作用會抑制其他植物生長，長期形成單一林相，生態多樣性偏低。作為海岸過渡帶可為候鳥提供停歇棲地',
    flowerSeason: '全年（零星）',
    nectarBearing: false,
    fruiting: false,
    estimatedYearsToMature: 10,
    conservationNote: '外來引進，海岸防風林主力，建議逐步混植本土海岸樹種',
  },

  // 追加常見台灣造林樹種
  'Koelreuteria henryi': {
    zhName: '台灣欒樹',
    origin: 'native',
    canopyLayer: 'canopy',
    habitatType: 'lowland',
    biodiversityScore: 5,
    keystone: true,
    birds: ['白頭翁', '烏頭翁', '台灣藍鵲', '麻雀'],
    insects: ['荔枝椿象天敵群', '台灣欒樹蚜蟲（吸引蚜繭蜂等天敵）', '蜜蜂科（多種）', '台灣鳳蝶'],
    mammals: ['赤腹松鼠'],
    soilRole: '落葉豐富，提升土壤有機碳，根系固坡效果佳',
    ecologicalRole: '台灣特有種，被譽為「四色樹」：綠葉 → 黃花（秋季壯觀）→ 紅色蒴果 → 褐色種莢，四季景觀變化豐富。花期蜜源吸引大量蜜蜂，紅色蒴果吸引鳥類，整體生態效益極高，是台灣都市與造林的優先推廣樹種',
    flowerSeason: '9–10 月（秋季）',
    nectarBearing: true,
    fruiting: true,
    estimatedYearsToMature: 15,
    conservationNote: '台灣特有種，四季觀賞與生態雙效，造林優先推薦',
  },

  'Bischofia javanica': {
    zhName: '茄苳',
    origin: 'native',
    canopyLayer: 'emergent',
    habitatType: 'lowland',
    biodiversityScore: 5,
    keystone: true,
    birds: ['台灣藍鵲', '黑枕藍鶲', '繡眼畫眉', '五色鳥', '紅嘴黑鵯'],
    insects: ['茄苳天牛', '茄苳造型蚜蟲天敵群', '台灣鳳蝶（幼蟲寄主）'],
    mammals: ['台灣獼猴', '白鼻心', '穿山甲'],
    soilRole: '老樹根系龐大，維繫深層土壤結構，落葉分解快速提升土壤氮磷含量',
    ecologicalRole: '台灣平地最長壽的原生樹種，許多縣市的「老樹公」即是茄苳，可存活數百年。成熟果實（紫黑色小漿果）是台灣藍鵲、五色鳥等鳥類的重要食源，老樹洞是穿山甲及多種蝙蝠的棲息場所',
    flowerSeason: '3–4 月',
    nectarBearing: false,
    fruiting: true,
    estimatedYearsToMature: 30,
    conservationNote: '台灣原生，民間「聖樹」，生態地位極高，老樹受法定保護',
  },

  'Ficus microcarpa': {
    zhName: '榕樹',
    origin: 'native',
    canopyLayer: 'emergent',
    habitatType: 'lowland',
    biodiversityScore: 5,
    keystone: true,
    birds: ['台灣藍鵲', '白頭翁', '紅嘴黑鵯', '台灣八哥', '綠鳩'],
    insects: ['榕果小蜂（共演化授粉者）', '台灣大鍬形蟲', '獨角仙'],
    mammals: ['台灣狐蝠', '台灣獼猴', '赤腹松鼠'],
    soilRole: '氣根固地，板根拓展土壤呼吸層，落葉厚積腐植質',
    ecologicalRole: '台灣最具代表性的生態關鍵物種之一，榕果與榕果小蜂的共演化是教科書級別的互利共生案例。一株榕樹在果期可同時吸引逾 20 種鳥類取食，是都市生物多樣性的熱點核心，也是台灣狐蝠的主要食物來源',
    flowerSeason: '全年（隱頭花序）',
    nectarBearing: false,
    fruiting: true,
    estimatedYearsToMature: 20,
    conservationNote: '台灣原生，生態關鍵物種，台灣狐蝠指標食物植物',
  },

  'Alnus formosana': {
    zhName: '台灣赤楊',
    origin: 'native',
    canopyLayer: 'canopy',
    habitatType: 'riparian',
    biodiversityScore: 4,
    keystone: false,
    birds: ['鉛色水鶇', '小剪尾', '翠鳥', '夜鷺'],
    insects: ['台灣赤楊蚜蟲天敵群', '蜉蝣（溪流水生昆蟲）', '石蛾'],
    mammals: ['水獺（溪流棲地指標）'],
    soilRole: '根瘤菌固氮能力強（每年每公頃固氮 100 kg 以上），是溪流兩岸崩塌地的先鋒固氮樹種',
    ecologicalRole: '台灣特有種，沿溪生長的先鋒固氮樹，根系穩固溪岸防止侵蝕。落葉進入溪流提供水生昆蟲食源，進而支撐溪流魚類族群。是台灣中海拔山地溪谷生態系的重要連結物種',
    flowerSeason: '1–3 月（冬末春初）',
    nectarBearing: false,
    fruiting: false,
    estimatedYearsToMature: 10,
    conservationNote: '台灣特有種，溪流生態護坡首選，固氮能力卓越',
  },
}

const DEFAULT_ECOLOGY = {
  zhName: '未知樹種',
  origin: 'unknown',
  canopyLayer: 'canopy',
  habitatType: 'lowland',
  biodiversityScore: 2,
  keystone: false,
  birds: ['各類留鳥'],
  insects: ['多種昆蟲'],
  mammals: [],
  soilRole: '提供遮蔭與有機質，基礎生態服務功能',
  ecologicalRole: '樹木為周遭生態系提供遮蔭、固碳、防風等基礎服務，是陸域生態系的核心組成',
  flowerSeason: '視樹種而定',
  nectarBearing: false,
  fruiting: false,
  estimatedYearsToMature: 20,
  conservationNote: '',
}

function getEcologyBySpecies(scientificName) {
  if (!scientificName) return { ...DEFAULT_ECOLOGY }
  if (ECOLOGY_DB[scientificName]) return { ...ECOLOGY_DB[scientificName] }
  // 屬名比對
  const genus = scientificName.split(' ')[0]
  const key = Object.keys(ECOLOGY_DB).find(k => k.startsWith(genus + ' '))
  return key ? { ...ECOLOGY_DB[key] } : { ...DEFAULT_ECOLOGY }
}

function getBiodiversityMarkdown(scientificName) {
  const eco = getEcologyBySpecies(scientificName)
  const originLabel = eco.origin === 'native' ? '🟢 台灣原生' : eco.origin === 'introduced' ? '🟡 引進種' : '❓ 未知'
  const keystoneLabel = eco.keystone ? '⭐ 是（關鍵物種）' : '否'
  const scoreStars = '★'.repeat(eco.biodiversityScore) + '☆'.repeat(5 - eco.biodiversityScore)

  return `## 🌿 生態多樣性貢獻

| 項目 | 內容 |
|------|------|
| **中文名** | ${eco.zhName} |
| **起源** | ${originLabel} |
| **林相層次** | ${eco.canopyLayer === 'emergent' ? '優勢木（突出層）' : eco.canopyLayer === 'canopy' ? '林冠層' : eco.canopyLayer === 'understory' ? '林下層' : '灌木層'} |
| **棲地類型** | ${eco.habitatType === 'lowland' ? '低海拔闊葉林' : eco.habitatType === 'montane' ? '中高海拔山地' : eco.habitatType === 'coastal' ? '海岸帶' : '溪流兩岸'} |
| **生態多樣性貢獻評分** | ${scoreStars}（${eco.biodiversityScore}/5） |
| **關鍵物種** | ${keystoneLabel} |
| **吸引鳥類** | ${eco.birds.join('、')} |
| **吸引昆蟲** | ${eco.insects.join('、')} |
| **哺乳動物** | ${eco.mammals.length > 0 ? eco.mammals.join('、') : '—'} |
| **土壤功能** | ${eco.soilRole} |
| **花期** | ${eco.flowerSeason} |
| **提供蜜源** | ${eco.nectarBearing ? '✅ 是' : '否'} |
| **提供果實** | ${eco.fruiting ? '✅ 是（鳥類/哺乳類食源）' : '否'} |

### 生態角色

${eco.ecologicalRole}

${eco.conservationNote ? `> **保育備註：** ${eco.conservationNote}` : ''}`
}

module.exports = { getEcologyBySpecies, getBiodiversityMarkdown, ECOLOGY_DB }
