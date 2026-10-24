import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.',import.meta.url)), base:'./', publicDir:false,
  plugins:[react()],
  build:{outDir:fileURLToPath(new URL('../../../.local/qa/desktop-audio-ab-v1/review-build',import.meta.url)),emptyOutDir:true, target:'es2022'},
});
