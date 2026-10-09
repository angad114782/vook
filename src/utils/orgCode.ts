/** Short unique code for quick-added departments/designations (the API requires one). */
export function makeOrgCode(name: string, taken: Iterable<string> = []): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const base = (words.length > 1 ? words.map((w) => w[0]).join('').slice(0, 4) : (words[0] ?? 'ORG').slice(0, 4)) || 'ORG';
  const used = new Set([...taken].map((code) => code.toUpperCase()));
  let code = base;
  for (let n = 2; used.has(code); n++) code = `${base}${n}`;
  return code;
}
