import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))

export default defineConfig({
  main: {},
  preload: {},
  renderer: { plugins: [react(), tailwind()], define: { __APP_VERSION__: JSON.stringify(version) } }
})
