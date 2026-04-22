import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// For GitHub Pages at tm-bts.github.io/blackjack/
// In dev (`npm run dev`) base is '/' so it works on localhost.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/blackjack/' : '/',
}))
