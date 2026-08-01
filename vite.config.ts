import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { banglaTtsApiPlugin } from './plugins/banglaTtsApi.ts'

export default defineConfig({
  plugins: [react(), banglaTtsApiPlugin()],
})
