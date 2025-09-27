/* eslint-disable import/no-extraneous-dependencies */
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      // "three-geo": resolve(__dirname, "../vendor/three-geo/src"), // Temporarily disabled
    },
  },
  server: {
    port: 5174,
    host: true,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  esbuild: {
    supported: {
      "top-level-await": true,
    },
  },
  css: {
    modules: {
      localsConvention: "camelCase",
    },
  },
  worker: {
    format: "es",
  },
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(css)$/.test(assetInfo.name)) {
            return `assets/css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
  },
});
