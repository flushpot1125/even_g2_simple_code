import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
		main: './index.html'

      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})