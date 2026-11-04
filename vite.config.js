import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Every API prefix the app calls is forwarded to the backend, so the browser
// talks to the Vite dev server (same origin) and CORS never applies.
const API_PREFIXES = [
  '/users',
  '/transactions',
  '/financial-accounts',
  '/budgets',
  '/reports',
  '/analytics',
  '/goals',
  '/recurring-bills',
  '/payments',
]

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env files so VITE_PROXY_TARGET can override the local backend.
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:8001'

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
