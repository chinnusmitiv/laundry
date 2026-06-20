import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shared = path.resolve(here, '../../shared');

export default defineConfig({
  plugins: [react()],
  resolve: { alias: [{ find: '@shared', replacement: shared }] },
  server: {
    port: 5173,
    fs: { allow: [path.resolve(here, '../../')] },
  },
});
