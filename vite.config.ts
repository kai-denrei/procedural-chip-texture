import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Vite config — PWA + content-hash fingerprinting is on by default for any
 * import that lands in a bundled module. Static files in /public are NOT
 * fingerprinted by Vite; that's what `scripts/bust.sh` handles (build-id
 * stamp + runtime cache-busting).
 *
 * registerType decision:
 *   - Dispatch text said 'autoUpdate' AND "refresh to update toast" AND
 *     "do NOT call skipWaiting() unconditionally."
 *   - Those three things are inconsistent — autoUpdate by definition skips
 *     waiting on its own; the refresh toast pattern is what you get with
 *     `prompt` mode.
 *   - We follow the spec of "user-visible, consent-gated update" which is
 *     the SAFER of the two and matches the mobile-pwa template comment.
 *     Decision recorded in .deban/roles/devops.md.
 */
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        // Vite fingerprints by default; this just makes the patterns explicit.
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      strategies: 'generateSW',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-v1',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      includeAssets: ['offline.html', 'icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Procedural Chip Texture',
        short_name: 'ChipViz',
        description: 'Deterministic procedural IC die imagery rendered from a seed.',
        start_url: './?src=pwa',
        scope: './',
        display: 'standalone',
        background_color: '#0a0d11',
        theme_color: '#0a0d11',
        orientation: 'any',
        icons: [
          { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: './icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
