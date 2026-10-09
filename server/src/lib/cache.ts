/** Tiny TTL cache with a size cap. Single-process; swap for Valkey/Redis when running several API instances. */
export class TtlCache<V> {
  private map = new Map<string, { value: V; expires: number }>();
  constructor(private ttlMs: number, private max = 5000) {}
  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) { this.map.delete(key); return undefined; }
    return hit.value;
  }
  set(key: string, value: V) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value as string);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
  }
  async wrap(key: string, load: () => Promise<V>): Promise<V> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = await load();
    this.set(key, value);
    return value;
  }
  deleteWhere(predicate: (key: string) => boolean) { for (const k of [...this.map.keys()]) if (predicate(k)) this.map.delete(k); }
  clear() { this.map.clear(); }
}
