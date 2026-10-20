import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for the pure analytics engine (lib/analytics), plus SQL policy
// tests (supabase/tests) on an in-memory Postgres. `@/` resolves to the repo
// root, matching tsconfig paths.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    include: ['lib/**/*.test.ts', 'components/**/*.test.ts', 'supabase/tests/**/*.test.ts'],
  },
});
