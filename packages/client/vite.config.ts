import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 7037,
    proxy: {
      '/api': 'http://localhost:7038',
      '/socket.io': {
        target: 'http://localhost:7038',
        ws: true,
      },
    },
  },
})
