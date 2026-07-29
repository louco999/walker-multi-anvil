import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site needs base = '/<repo-name>/'
// Local dev: leave unset or VITE_BASE_PATH=/
// CI sets VITE_BASE_PATH=/${{ github.event.repository.name }}/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
})
