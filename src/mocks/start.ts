export async function startMocking(): Promise<void> {
  // Keep this comparison compile-time visible so API builds do not include or
  // request the MSW browser implementation.
  if (import.meta.env.VITE_DATA_MODE?.trim().toLowerCase() === 'api') return;
  const { worker } = await import('./browser');
  await worker.start({
    onUnhandledRequest(request, print) {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) print.error();
    },
  });
}
