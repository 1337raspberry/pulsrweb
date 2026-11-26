import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  server: { port: 8137, strictPort: true },
  preview: { port: 8138, strictPort: true },
});
