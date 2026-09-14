import type { Socket } from 'socket.io-client';

type Listener = (...args: any[]) => void;

class InMemorySocket {
  connected = true;
  auth: Record<string, unknown> = {};
  private listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener) {
    const listeners = this.listeners.get(event) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return this;
  }
  off(event: string, listener?: Listener) {
    if (!listener) this.listeners.delete(event);
    else this.listeners.get(event)?.delete(listener);
    return this;
  }
  emit(event: string, ...args: any[]) {
    const maybeAck = typeof args.at(-1) === 'function' ? args.pop() as Listener : undefined;
    if (event === 'support:comment') {
      const payload = args[0] as Record<string, unknown>;
      queueMicrotask(() => this.dispatch('support:comment', { id: `comment_${Date.now()}`, ...payload, createdAt: new Date().toISOString() }));
    }
    if (event === 'support:typing') queueMicrotask(() => this.dispatch('support:typing', args[0]));
    if (event === 'support:read') maybeAck?.(null, { ok: true });
    else maybeAck?.({ ok: true });
    return this;
  }
  timeout() { return this; }
  connect() { this.connected = true; queueMicrotask(() => this.dispatch('connect')); return this; }
  disconnect() { this.connected = false; this.dispatch('disconnect', 'client disconnect'); return this; }
  private dispatch(event: string, ...args: any[]) { this.listeners.get(event)?.forEach((listener) => listener(...args)); }
}

export const createMockSocket = (): Socket => new InMemorySocket() as unknown as Socket;
