// NOAA 太陽位置演算法（純本地計算，無外部依賴）
// 參考：NOAA Solar Position Calculator
// 回傳：sunrise/sunset (unix epoch), dayLengthH, solarElevationDeg, solarAzimuthDeg

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

function julianDay(unixTs) {
  return unixTs / 86400 + 2440587.5
}

function solarMeanAnomaly(jd) {
  return DEG * (357.5291 + 0.98560028 * (jd - 2451545))
}

function eclipticLongitude(M) {
  const C = DEG * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const P = DEG * 102.9372
  return M + C + P + Math.PI
}

function sunCoords(jd) {
  const M = solarMeanAnomaly(jd)
  const L = eclipticLongitude(M)
  const e = DEG * 23.4397
  const dec = Math.asin(Math.sin(e) * Math.sin(L))
  const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L))
  return { dec, ra }
}

function siderealTime(jd, lng) {
  return DEG * (280.16 + 360.9856235 * (jd - 2451545)) - DEG * (-lng)
}

function azimuth(H, phi, dec) {
  return Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi))
}

function altitude(H, phi, dec) {
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H))
}

function getSunPosition(lat, lng, unixTs) {
  const jd = julianDay(unixTs)
  const c = sunCoords(jd)
  const H = siderealTime(jd, lng) - c.ra
  const phi = DEG * lat

  const elevation = altitude(H, phi, c.dec) * RAD
  let azDeg = azimuth(H, phi, c.dec) * RAD + 180
  azDeg = ((azDeg % 360) + 360) % 360

  // 日出日落（給定當日 00:00 UTC 的 JD）
  const J2000 = 2451545
  const n = Math.round(jd - J2000 - 0.0009 + lng / 360)
  const Jnoon = J2000 + 0.0009 - lng / 360 + n
  const M = DEG * (357.5291 + 0.98560028 * (Jnoon - J2000))
  const L = eclipticLongitude(M)
  const dec = Math.asin(Math.sin(DEG * 23.4397) * Math.sin(L))
  const cosH0 = (Math.sin(DEG * -0.833) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))

  let sunriseUnix = null, sunsetUnix = null, dayLengthH = null
  if (cosH0 >= -1 && cosH0 <= 1) {
    const H0 = Math.acos(cosH0)
    const Jset = Jnoon + (H0 * RAD) / 360 + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)
    const Jrise = Jnoon - (H0 * RAD) / 360 + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)
    sunriseUnix = Math.round((Jrise - 2440587.5) * 86400)
    sunsetUnix = Math.round((Jset - 2440587.5) * 86400)
    dayLengthH = Math.round(((sunsetUnix - sunriseUnix) / 3600) * 100) / 100
  }

  return {
    sunrise: sunriseUnix,
    sunset: sunsetUnix,
    dayLengthH,
    solarElevationDeg: Math.round(elevation * 100) / 100,
    solarAzimuthDeg: Math.round(azDeg * 100) / 100,
  }
}

module.exports = { getSunPosition }
