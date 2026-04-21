/**
 * main.jsx - Entry point React
 *
 * createRoot() monta l'app React sul div #root in index.html.
 * StrictMode è utile in sviluppo: rileva effetti collaterali e
 * pratiche deprecate renderizzando i componenti due volte (solo in dev).
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
