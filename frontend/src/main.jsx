import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import DevInterface from './DevInterface.jsx'
import { GraphProvider } from './store/GraphContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <GraphProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/dev" element={<DevInterface />} />
        </Routes>
      </GraphProvider>
    </BrowserRouter>
  </StrictMode>,
)
