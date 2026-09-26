import axios, { type AxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { isMockMode, runtimeConfig } from '../config/runtime';
import { toV2ResourcePath } from './routes';

let csrfToken: string | null = null;
export const setCsrfToken = (value: string | null) => { csrfToken = value; };

const api = axios.create({
  baseURL: runtimeConfig.apiBaseUrl,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request — attach access token ────────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof config.url === 'string') config.url = toV2ResourcePath(config.url);
  const method = config.method?.toUpperCase();
  if (csrfToken && method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// ── Response — refresh token once on 401, then kick to /login ───
let isRefreshing = false;
let pendingQueue: Array<{ resolve: () => void; reject: (err: unknown) => void }> = [];

const drainQueue = (err?: unknown) => {
  pendingQueue.forEach((pending) => (err ? pending.reject(err) : pending.resolve()));
  pendingQueue = [];
};

api.interceptors.response.use(
  (response) => {
    const body = response.data as { data?: unknown } | undefined;
    if (body && 'data' in body && !(body instanceof Blob)) response.data = body.data;
    return response;
  },
  async (error) => {
    const authEndpoint = ['/auth/login', '/auth/session', '/auth/refresh'].includes(error.config?.url);
    if (import.meta.env.DEV && !(authEndpoint && error.response?.status === 401)) {
      console.error(
        `[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} →`,
        error.response ? `HTTP ${error.response.status}` : error.message,
      );
    }

    const status = error.response?.status;
    const original = error.config as AxiosRequestConfig & { _mockGetRetry?: number };
    const retryCount = original?._mockGetRetry ?? 0;
    const method = original?.method?.toUpperCase();
    const transientMockReadFailure = !status || (status >= 500 && status !== 501);
    if (isMockMode && method === 'GET' && retryCount < 1 && transientMockReadFailure) {
      original._mockGetRetry = retryCount + 1;
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      return api(original);
    }

    if (status === 409) {
      toast.error(error.response?.data?.error?.message ?? error.response?.data?.message ?? 'This record changed. Refresh and try again.');
    }
    if (status && status >= 500) {
      toast.error('Server error. Please try again.');
    }

    const authOriginal = original as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || authOriginal._retry || authEndpoint) {
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: () => resolve(api(original)),
          reject,
        });
      });
    }

    authOriginal._retry = true;
    isRefreshing = true;

    try {
      const response = await axios.post(`${runtimeConfig.apiBaseUrl}/auth/refresh`, {}, { withCredentials: true });
      const data = response.data?.data ?? response.data;
      setCsrfToken(data.csrfToken ?? null);
      window.dispatchEvent(new CustomEvent('auth:session-refreshed'));

      drainQueue();
      return api(authOriginal);
    } catch (refreshErr) {
      drainQueue(refreshErr);
      setCsrfToken(null);
      window.location.href = '/login';
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
