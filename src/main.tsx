import React from 'react'
import ReactDOM from 'react-dom/client'
import AuthGate from './auth/AuthGate'
import './styles.css'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/ai-forex-hub/sw.js', { scope: '/ai-forex-hub/' }).catch(error => {
      console.warn('Kopela offline support could not be registered:', error)
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthGate /></React.StrictMode>)
