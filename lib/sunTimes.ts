export function getSunTimes(lat: number, lng: number, date: Date = new Date()): { sunrise: number; sunset: number } {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));

  const latRad = (lat * Math.PI) / 180;
  const decRad = (declination * Math.PI) / 180;

  const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);

  if (cosHourAngle < -1 || cosHourAngle > 1) {
    return { sunrise: 360, sunset: 1080 };
  }

  const hourAngle = Math.acos(cosHourAngle) * (180 / Math.PI);
  const solarNoon = 720 + lng * 4;
  const sunrise = solarNoon - hourAngle * 4;
  const sunset = solarNoon + hourAngle * 4;

  if (!Number.isFinite(sunrise) || !Number.isFinite(sunset)) {
    return { sunrise: 360, sunset: 1080 };
  }

  return { sunrise: Math.round(sunrise), sunset: Math.round(sunset) };
}

export function isEventWindow(lat: number = 0, lng: number = 0): { active: boolean; eventName: string } {
  const { sunrise, sunset } = getSunTimes(lat, lng);
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();

  if (minutes >= sunrise && minutes <= sunrise + 120) {
    return { active: true, eventName: 'SUNRISE' };
  }
  if (minutes >= sunset && minutes <= sunset + 120) {
    return { active: true, eventName: 'SUNSET' };
  }
  return { active: false, eventName: '' };
}
