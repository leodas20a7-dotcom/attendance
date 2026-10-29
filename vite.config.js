import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// Generate a discrete build version string
const APP_VERSION = 'v_' + Math.floor(Date.now() / 1000);

const buildVersionPlugin = () => ({
  name: 'build-version-plugin',
  buildStart() {
    const versionData = {
      version: APP_VERSION,
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
export default defineConfig(({ command }) => {
  const isDev = command === 'serve';
  const currentVersion = isDev ? 'dev' : APP_VERSION;

  return {
    plugins: [react(), !isDev && buildVersionPlugin()].filter(Boolean),
    define: {
      __APP_VERSION__: JSON.stringify(currentVersion),
      __IS_DEV__: isDev,
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
  };
});
