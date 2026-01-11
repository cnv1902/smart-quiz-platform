import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // THÊM ĐOẠN NÀY ĐỂ MỞ KHÓA DOMAIN
    allowedHosts: [
      'quizz.iamchuong.id.vn',
      '.trycloudflare.com',
      '.ngrok-free.app'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
    // Nếu bạn muốn share qua mạng LAN cho điện thoại truy cập
    host: true, 
  },
})