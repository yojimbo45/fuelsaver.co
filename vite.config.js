import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Convert render-blocking CSS to async loading in production builds */
function asyncCssPlugin() {
  return {
    name: 'async-css',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /<link rel="stylesheet" ([^>]*?)>/g,
        (match, attrs) => {
          const href = attrs.match(/href="([^"]+)"/)?.[1] || '';
          return `<link rel="stylesheet" ${attrs} media="print" onload="this.media='all'">` +
            `<noscript><link rel="stylesheet" href="${href}"></noscript>`;
        }
      );
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), asyncCssPlugin()],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('maplibre-gl')) return 'maplibre';
        },
      },
    },
  },
})
