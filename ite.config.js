import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 1. Verify your repo name is EXACTLY 'pos' (case-sensitive)
  // 2. If your repo is named 'my-app', change this to '/my-app/'
  base: '/pos/', 
  build: {
    outDir: 'dist',
  },
})