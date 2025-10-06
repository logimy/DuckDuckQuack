import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 4000,
    ...(process.env.VITE_ENABLE_SSL === "true" && {
      https: {
        key: fs.readFileSync(process.env.VITE_SSL_KEY_PATH || './ssl/localhost-key.pem'),
        cert: fs.readFileSync(process.env.VITE_SSL_CERT_PATH || './ssl/localhost.pem')
      }
    })
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  }
})
