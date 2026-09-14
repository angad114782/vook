export type DataMode = 'mock' | 'api';

const rawMode = import.meta.env.VITE_DATA_MODE?.trim().toLowerCase();

export const runtimeConfig = Object.freeze({
  dataMode: (rawMode === 'api' ? 'api' : 'mock') as DataMode,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || '/api/v2',
  realtimeUrl: import.meta.env.VITE_REALTIME_URL?.trim() || undefined,
});

export const isMockMode = runtimeConfig.dataMode === 'mock';
