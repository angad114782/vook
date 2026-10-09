import api from '../api/axios';

/**
 * Invisible "are you a person?" check. The server hands out a small puzzle; the browser solves it in a background
 * thread (well under a second normally) and sends the answer with the form. People never notice; scripts that try
 * thousands of passwords have to pay for every attempt. Nothing for the user to click.
 */
export interface BotProof { token: string; counter: number }

const WORKER_SOURCE = `
self.onmessage = async (e) => {
  const { token, difficulty } = e.data;
  const enc = new TextEncoder();
  for (let i = 0; ; i++) {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(token + ':' + i)));
    let bits = 0;
    for (const b of h) { if (b === 0) { bits += 8; continue; } bits += Math.clz32(b) - 24; break; }
    if (bits >= difficulty) { self.postMessage(i); return; }
  }
};`;

function solve(token: string, difficulty: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    const worker = new Worker(url);
    const done = () => { worker.terminate(); URL.revokeObjectURL(url); };
    worker.onmessage = (e) => { done(); resolve(e.data as number); };
    worker.onerror = (e) => { done(); reject(e); };
    worker.postMessage({ token, difficulty });
  });
}

/** Server proofs expire after 2 minutes; stay well inside that so a person who waits on the page never sends a stale one. */
const MAX_AGE_MS = 75_000;

async function fetchAndSolve(): Promise<{ proof: BotProof | null; failed: boolean }> {
  try {
    const { data } = await api.get<{ enabled: boolean; token?: string; difficulty?: number }>('/auth/challenge');
    if (!data.enabled || !data.token || !data.difficulty) return { proof: null, failed: false }; // protection is off on this server
    if (!window.crypto?.subtle || typeof Worker === 'undefined') return { proof: null, failed: false };
    return { proof: { token: data.token, counter: await solve(data.token, data.difficulty) }, failed: false };
  } catch {
    return { proof: null, failed: true }; // server not reachable yet (starting up): do not remember this, ask again next time
  }
}

let ready: { at: number; promise: ReturnType<typeof fetchAndSolve> } | null = null;
/** Start solving early (when a form appears) so the answer is ready by the time the person presses the button. */
export function prepareBotProof() {
  if (ready && Date.now() - ready.at > MAX_AGE_MS) ready = null;
  if (!ready) {
    const entry = { at: Date.now(), promise: fetchAndSolve() };
    ready = entry;
    void entry.promise.then((r) => { if (r.failed && ready === entry) ready = null; });
  }
  return ready.promise.then((r) => r.proof);
}
/** Returns a fresh proof for one request. Each proof works once, so the next one is prepared right away. */
export async function takeBotProof(): Promise<BotProof | null> {
  if (ready && Date.now() - ready.at > MAX_AGE_MS) ready = null;
  let result = await (ready ?? (ready = { at: Date.now(), promise: fetchAndSolve() })).promise;
  if (result.failed) { ready = null; result = await fetchAndSolve(); } // one more try before giving up
  ready = null;
  return result.proof;
}

/** Runs a request that carries a proof; if the server says the proof was not accepted, quietly gets a new one and retries once. */
export async function withBotProof<T>(send: (proof: BotProof | null) => Promise<T>): Promise<T> {
  try { return await send(await takeBotProof()); }
  catch (error) {
    if ((error as { response?: { data?: { error?: { code?: string } } } }).response?.data?.error?.code !== 'BOT_CHECK_FAILED') throw error;
    return send(await takeBotProof());
  }
}
