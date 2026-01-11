import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

// Set document title from environment variable
document.title = `${import.meta.env.VITE_APP_NAME || 'Quiz Platform'} - Quiz Platform`;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#ffffff',
            color: '#334155',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
          },
          success: {
            iconTheme: {
              primary: '#0EA5E9',
              secondary: '#ffffff',
            },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
)
