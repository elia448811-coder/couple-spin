import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE_PATH || process.env.VITE_BASE_PATH || '/';

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'favicon.svg',
          'robots.txt',
          'pwa-192.png',
          'pwa-512.png',
          'pwa-maskable-512.png',
          'apple-touch-icon.png',
        ],
        manifest: {
          name: 'ספין זוגי | Couple Spin',
          short_name: 'ספין זוגי',
          description: 'משחק משימות מצחיק וכיפי לזוגות — בלי שאלות, רק משימות!',
          theme_color: '#10071f',
          background_color: '#10071f',
          display: 'standalone',
          orientation: 'portrait',
          lang: 'he',
          dir: 'rtl',
          start_url: base,
          scope: base,
          icons: [
            { src: `${base}pwa-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: `${base}pwa-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: `${base}pwa-maskable-512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          screenshots: [
            {
              src: `${base}pwa-512.png`,
              sizes: '512x512',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'מסך משחק',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
          navigateFallback: `${base}index.html`,
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
    build: {
      outDir: 'dist',
      sourcemap: false,
      target: 'es2020',
    },
    preview: {
      port: 4173,
      host: true,
    },
  };
});
