import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 9008,
    historyApiFallback: true,
    proxy: {
      '/api': {
        target: 'http://localhost:9508',
        changeOrigin: true
      }
    }
  }
})
