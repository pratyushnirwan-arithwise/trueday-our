import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  logLevel: 'warn', // Suppress deprecation warnings
  base: '/',
  server: {
    host: 'localhost',
    port: 3000,
    strictPort: true,
    open: true,
    fs: {
      allow: ['.', '../backend']
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5009'
      }
    }

  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: false, // Disable sourcemaps to reduce memory usage
    minify: 'esbuild', // Use esbuild instead of terser for better memory efficiency
    chunkSizeWarningLimit: 1000, // Increase warning limit to 1MB
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // More aggressive chunking to reduce memory usage
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('react-router')) {
              return 'router-vendor';
            }
            if (id.includes('react-beautiful-dnd') || id.includes('react-datepicker') || id.includes('react-toastify')) {
              return 'ui-vendor';
            }
            if (id.includes('axios') || id.includes('framer-motion') || id.includes('lucide-react')) {
              return 'utils-vendor';
            }
            return 'vendor';
          }
        },
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: ({ name }) => {
          const ext = name?.split('.').pop();
          if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
            return 'assets/images/[name].[hash][extname]';
          }
          if (ext === 'css') {
            return 'assets/css/[name].[hash][extname]';
          }
          if (['woff', 'woff2', 'ttf', 'eot'].includes(ext)) {
            return 'assets/fonts/[name].[hash][extname]';
          }
          return 'assets/[name].[hash][extname]';
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['js-big-decimal']
  },
  esbuild: {
    // Reduce memory usage during build
    target: 'es2020',
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true
  }
});
