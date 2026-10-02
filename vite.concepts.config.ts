import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Concept gallery (UI exploration) — separate from the production build:
//   npm run concepts        → http://127.0.0.1:5174/concepts/   (gallery; "/" redirects here)
//   npm run concepts:build  → concepts-dist/ (static)
// Own port = own browser origin = own localStorage, so production / dev data is never touched.
const redirectRoot = (): Plugin => ({
  name: 'redirect-root-to-gallery',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/' || req.url === '/index.html') {
        res.statusCode = 302;
        res.setHeader('Location', '/concepts/');
        res.end();
        return;
      }
      next();
    });
  },
});

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [react(), redirectRoot()],
  server: { host: '127.0.0.1', port: 5174 },
  preview: { host: '127.0.0.1', port: 5175 },
  build: {
    outDir: 'concepts-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        ['index', 'concept-a', 'concept-b', 'concept-c', 'concept-d', 'concept-e'].map((n) => [n, resolve(__dirname, `concepts/${n}.html`)]),
      ),
    },
  },
});
