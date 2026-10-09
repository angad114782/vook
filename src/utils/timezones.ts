const FALLBACK = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Karachi', 'Asia/Dhaka', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];

/** Every time zone the browser knows, so no company is stuck with three choices. The saved value is always included. */
export function timeZones(current?: string): string[] {
  let all: string[] = FALLBACK;
  try { const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone'); if (list?.length) all = list; } catch { /* older browsers use the short list */ }
  const set = new Set(all);
  if (current) set.add(current);
  return [...set].sort((a, b) => a.localeCompare(b));
}
