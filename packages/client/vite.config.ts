import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8648',
      '/socket.io': {
        target: 'http://localhost:8648',
        ws: true,
      },
    },
  },
})
