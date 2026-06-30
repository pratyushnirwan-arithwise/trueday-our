import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // SSE stream must be proxied with response buffering disabled
      '/api/notifications/stream': {
        target: 'http://127.0.0.1:5009',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Disable buffering so SSE events are forwarded immediately
            proxyRes.headers['x-accel-buffering'] = 'no';
          });
        }
      },
      '/api': {
        target: 'http://127.0.0.1:5009',
        changeOrigin: true,
      },
      '/login': {
        target: 'http://127.0.0.1:5009',
        changeOrigin: true,
      },
      '/users': {
        target: 'http://127.0.0.1:5009',
        changeOrigin: true,
      },
      '/register': {
        target: 'http://127.0.0.1:5009',
        changeOrigin: true,
      },
      '/tickets': {
        target: 'http://127.0.0.1:5009',
        changeOrigin: true,
      },
      '/upload_attachment': {
        target: 'http://127.0.0.1:5009',
        changeOrigin: true,
      },
      '/attachments': {
        target: 'http://127.0.0.1:5009',
        changeOrigin: true,
      },
      '/add_ticket_message': {
        target: 'http://127.0.0.1:5009',
        changeOrigin: true,
      },
      '/get_ticket_messages': {
        target: 'http://127.0.0.1:5009',
        changeOrigin: true,
      },
      '/get_ticket_attachments': {
        target: 'http://127.0.0.1:5009',
        changeOrigin: true,
      },
      '/delete_attachment': {
        target: 'http://127.0.0.1:5009',
        changeOrigin: true,
      },
      '/permanently_delete_ticket': {
        target: 'http://127.0.0.1:5009',
        changeOrigin: true,
      },
      '/create_ticket': {
        target: 'http://127.0.0.1:5009',
        changeOrigin: true,
      },
      '/edit-ticket': {
        target: 'http://127.0.0.1:5009',
        changeOrigin: true,
      }
    }
  }
})
