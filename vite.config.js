import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

const buildTimePlugin = () => ({
  name: 'build-time-plugin',
  buildStart() {
    const versionData = {
      buildTime: Date.now(),
      buildDate: new Date().toISOString()
    };
    try {
      if (!fs.existsSync('public')) fs.mkdirSync('public');
      fs.writeFileSync('public/version.json', JSON.stringify(versionData, null, 2));
    } catch (e) {
      console.warn('Could not write version.json', e);
    }
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), buildTimePlugin()],
  define: {
    __APP_BUILD_TIME__: Date.now(),
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  css: {
    postcss: {},
  },
})
