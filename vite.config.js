import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import localDbFilePlugin from './vite-localdb-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    localDbFilePlugin(),
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Split the rarely-changing framework libs into their own chunk,
        // separate from app code (which changes on every release). Purely a
        // caching/parallel-download optimization — same code, same
        // behavior, just grouped differently across files.
        // Vite 8 bundles with Rolldown, which has no Rollup-style
        // `manualChunks` object; a codeSplitting group matched on package
        // paths does the same (react-router, scheduler and query-core were
        // pulled in implicitly by the old object form as dependencies).
        codeSplitting: {
          groups: [
            {
              name: "vendor",
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@tanstack[\\/]react-query|@tanstack[\\/]query-core|zustand)[\\/]/,
            },
          ],
        },
      },
    },
  },
});
