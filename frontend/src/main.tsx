import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { AuthProvider } from './AuthProvider'
import { ThemeProvider } from './theme/ThemeProvider'

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('No se encontró el contenedor raíz de la aplicación.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
