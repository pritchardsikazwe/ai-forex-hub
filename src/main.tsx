import React from 'react'
import ReactDOM from 'react-dom/client'
import AuthGate from './auth/AuthGate'
import './styles.css'
import './kopela-branding.css'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(error => {
      console.warn('Kopam offline support could not be registered:', error)
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthGate /></React.StrictMode>)
