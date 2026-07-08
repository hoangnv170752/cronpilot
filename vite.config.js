/*
 * Copyright (c) 2026 by Christian Kellner.
 * Licensed under Apache-2.0 with Commons Clause and Attribution/Naming Clause
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'client',
  plugins: [react(), tailwindcss()],
  server: {
    port: 6788,
    proxy: {
      '/api': 'http://localhost:6778',
    },
  },
  test: {
    root: '.',
    include: ['client/tests/**/*.test.{js,jsx}'],
    environment: 'happy-dom',
    setupFiles: ['client/tests/setup.js'],
    globals: true,
  },
});
