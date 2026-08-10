import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Deployed as a GitHub Pages *project* site at https://<user>.github.io/ducodash/,
// so every asset URL needs that prefix. Overridable for user/org sites or local
// static previews via BASE_PATH=/ npm run build.
const base = process.env.BASE_PATH ?? '/ducodash/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    // The dashboard is a single view; splitting it buys nothing but round trips.
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
