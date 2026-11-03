import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative assets work both on GitHub Pages under /ai-forex-hub/ and inside the Capacitor APK.
  base: './',
})
