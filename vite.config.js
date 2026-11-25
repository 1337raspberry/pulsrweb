import { defineConfig } from 'vite';

export default defineConfig({
  base: '/pulsrweb/',
  server: { port: 8137, strictPort: true },
  preview: { port: 8138, strictPort: true },
});
