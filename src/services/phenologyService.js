// 物候推算：根據月份 × 緯度 × 海拔本地推算當下生態現象標籤
// 不呼叫外部 API，純規則式（規則來自台灣林業試驗所、特有生物研究保育中心公開資料）

// 海拔 → 森林帶
function inferForestZone(altitudeM) {
  if (altitudeM == null) return 'unknown'
  if (altitudeM < 100) return 'coastal'              // 海岸帶
  if (altitudeM < 500) return 'lowland_broadleaf'    // 低海拔闊葉林
  if (altitudeM < 1500) return 'foothill_broadleaf'  // 山麓闊葉林
  if (altitudeM < 2500) return 'montane_mixed'       // 中海拔針闊葉混交林
  if (altitudeM < 3100) return 'upper_montane'       // 上部山地針葉林
  return 'subalpine'                                  // 亞高山針葉林
}

const FOREST_ZONE_LABEL_ZH = {
  coastal: '海岸防風林帶',
  lowland_broadleaf: '低海拔闊葉林',
  foothill_broadleaf: '山麓闊葉林',
  foothill_broadleaf_montane: '低中海拔過渡帶',
  montane_mixed: '中海拔針闊葉混交林',
  upper_montane: '上部山地針葉林',
  subalpine: '亞高山針葉林',
  unknown: '未知海拔帶',
}

// 月份 → 季節（台灣亞熱帶劃分）
function inferSeason(month, lat) {
  // 北回歸線以南略偏熱帶
  const tropical = (lat != null && lat < 23.5)
  if (tropical) {
    if (month >= 5 && month <= 10) return 'wet_summer'    // 雨季
    return 'dry_winter'                                    // 乾季
  }
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

const SEASON_LABEL_ZH = {
  spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季',
  wet_summer: '雨季', dry_winter: '乾季',
}

// 月份 × 海拔 → 物候標籤陣列
function inferPhenologyTags({ unixTs, lat, altitudeM }) {
  const tags = []
  if (!unixTs) return tags
  const d = new Date(unixTs * 1000)
  const month = d.getMonth() + 1  // 1-12
  const zone = inferForestZone(altitudeM)
  const season = inferSeason(month, lat)

  // ── 鳥類物候（台灣留鳥繁殖期主要集中 3–7 月）
  if (month >= 3 && month <= 5) tags.push('bird_breeding_early')
  else if (month >= 6 && month <= 7) tags.push('bird_breeding_late')
  else if (month >= 9 && month <= 11) tags.push('bird_migration_autumn')
  else if (month >= 2 && month <= 3) tags.push('bird_migration_spring')

  // ── 昆蟲物候
  if (month >= 4 && month <= 6) tags.push('insect_emergence')          // 羽化季
  if (month >= 6 && month <= 8) tags.push('insect_peak_activity')      // 高峰
  if (month >= 5 && month <= 7) tags.push('beetle_sap_feeding')        // 甲蟲樹液期
  if (month === 4 || month === 5) tags.push('termite_alates_flight')   // 白蟲分飛

  // ── 植物物候
  if (month >= 2 && month <= 4) tags.push('leaf_flush')                // 抽新葉
  if (month >= 3 && month <= 5) tags.push('flower_peak_lowland')       // 低海拔花期
  if (month >= 8 && month <= 10) tags.push('flower_peak_autumn')       // 秋季開花（如台灣欒樹）
  if (month >= 9 && month <= 11) tags.push('fruit_ripening')           // 果實成熟
  if (month === 11 || month === 12 || month === 1) tags.push('leaf_color_change')  // 變葉

  // ── 海拔修正（高海拔物候延後 2-4 週）
  if (zone === 'montane_mixed' || zone === 'upper_montane' || zone === 'subalpine') {
    // 高海拔晚春→初夏才花期
    const idx = tags.indexOf('flower_peak_lowland')
    if (idx !== -1) tags.splice(idx, 1)
    if (month >= 5 && month <= 7) tags.push('flower_peak_montane')
  }

  // ── 兩棲類繁殖窗口
  if (month >= 3 && month <= 9 && (zone === 'lowland_broadleaf' || zone === 'foothill_broadleaf')) {
    tags.push('amphibian_breeding')
  }

  // ── 真菌爆發（梅雨 + 颱風期）
  if (month >= 5 && month <= 9) tags.push('fungal_fruiting_window')

  // ── 哺乳類
  if (month >= 4 && month <= 7) tags.push('flying_squirrel_pups')      // 飛鼠幼仔
  if (month === 12 || month === 1 || month === 2) tags.push('mammal_winter_torpor_low')  // 冬季活動降低

  return tags
}

// 標籤 → 中文敘事用語
const PHENOLOGY_LABEL_ZH = {
  bird_breeding_early: '鳥類繁殖初期',
  bird_breeding_late: '鳥類繁殖末期（雛鳥離巢）',
  bird_migration_autumn: '秋季候鳥南遷',
  bird_migration_spring: '春季候鳥北返',
  insect_emergence: '昆蟲羽化期',
  insect_peak_activity: '昆蟲活動高峰',
  beetle_sap_feeding: '甲蟲樹液取食期',
  termite_alates_flight: '白蟻分飛',
  leaf_flush: '新葉萌發',
  flower_peak_lowland: '低海拔花期高峰',
  flower_peak_montane: '中高海拔花期高峰',
  flower_peak_autumn: '秋季花期（金黃）',
  fruit_ripening: '果實成熟期',
  leaf_color_change: '葉色轉變期',
  amphibian_breeding: '兩棲類繁殖期',
  fungal_fruiting_window: '菌類子實體爆發窗口',
  flying_squirrel_pups: '飛鼠育幼期',
  mammal_winter_torpor_low: '哺乳類冬季活動降低',
}

function describePhenology(tags) {
  if (!tags || !tags.length) return ''
  return tags.map(t => PHENOLOGY_LABEL_ZH[t] || t).join('、')
}

module.exports = {
  inferForestZone,
  inferSeason,
  inferPhenologyTags,
  describePhenology,
  FOREST_ZONE_LABEL_ZH,
  SEASON_LABEL_ZH,
  PHENOLOGY_LABEL_ZH,
}
