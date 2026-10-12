import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Every API prefix the app calls is forwarded to the backend, so the browser
// talks to the Vite dev server (same origin) and CORS never applies.
const API_PREFIXES = ['/users', '/transactions', '/budgets', '/reports']

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env files so VITE_PROXY_TARGET can be set there. Port 8000 is
  // commonly taken on this machine (another Django app is served through
  // Docker/WSL there), so the FastAPI backend defaults to 8010.
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8010'

  return {
    plugins: [react()],
    server: {
      proxy: Object.fromEntries(
        API_PREFIXES.map((prefix) => [
          prefix,
          { target: backendTarget, changeOrigin: true },
        ]),
      ),
    },
  }
})
