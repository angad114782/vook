import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', testTimeout: 60_000, hookTimeout: 180_000, include: ['test/**/*.test.ts'], fileParallelism: true, maxWorkers: 3 } // each file builds its own ~50-collection database; a free Atlas cluster allows 500 in total,
});
