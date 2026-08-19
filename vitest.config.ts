import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Ver tests/helpers/server-only-stub.ts.
      'server-only': resolve(__dirname, './tests/helpers/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: { reporter: ['text', 'lcov'], include: ['src/recommendation/**', 'src/domain/**'] },
  },
});
