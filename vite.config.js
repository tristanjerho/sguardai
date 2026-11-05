import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function devChatApiPlugin() {
  return {
    name: 'dev-chat-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (url === '/api/chat' || url.startsWith('/api/chat?') || url === '/api/chat/status') {
          try {
            const chatModule = await import('./api/chat.js');
            const chatHandler = chatModule.default;
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
              try {
                req.body = body ? JSON.parse(body) : {};
              } catch {
                req.body = {};
              }
              const mockRes = {
                statusCode: 200,
                headers: {},
                setHeader(name, value) {
                  this.headers[name] = value;
                  res.setHeader(name, value);
                },
                status(code) {
                  this.statusCode = code;
                  res.statusCode = code;
                  return this;
                },
                json(data) {
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = this.statusCode;
                  res.end(JSON.stringify(data));
                },
                end(data) {
                  res.statusCode = this.statusCode;
                  res.end(data || '');
                }
              };
              await chatHandler(req, mockRes);
            });
            return;
          } catch (e) {
            console.error('Error in dev chat API middleware:', e);
          }
        }
        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    devChatApiPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'SmileGuard AI - Clinical Dental & Orthodontic Care',
        short_name: 'SmileGuard AI',
        description: 'Enterprise dental clinic management, orthodontic progression, 32-tooth odontogram, and digital laboratory pipeline.',
        theme_color: '#0d9488',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Caches ONLY static application assets (JS, CSS, HTML shell, static SVGs/Fonts)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // STRICT ZERO CLINICAL CACHING: Do NOT cache Firestore, Cloudinary, Auth, or AI endpoints
        navigateFallbackDenylist: [
          /^\/api/,
          /^https:\/\/firestore\.googleapis\.com/,
          /^https:\/\/res\.cloudinary\.com/,
          /^https:\/\/identitytoolkit\.googleapis\.com/,
          /^https:\/\/securetoken\.googleapis\.com/,
        ],
        runtimeCaching: [
          {
            // Google Fonts stylesheets
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Google Fonts webfont files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: false,
  },
});
