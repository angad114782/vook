/** Date/time in a company's timezone (default India). Attendance "today" must follow the workplace clock, not the server's. */
export function localParts(tz = 'Asia/Kolkata', at = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export const minutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h ?? 0) * 60 + (m ?? 0); };

export const durationLabel = (checkIn?: string | null, checkOut?: string | null) => {
  if (!checkIn || !checkOut) return '--';
  const total = Math.max(0, minutes(checkOut) - minutes(checkIn));
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
};

export const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(a));
};

export const daysBetweenInclusive = (start: string, end: string) => Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
