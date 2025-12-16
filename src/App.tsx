// src/App.tsx
// CRITICAL: Main application component with React Router setup
// Dashboard is now the landing page at "/"

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Index from './pages/Index'
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Dashboard (Project List) is now the landing page */}
        <Route path="/" element={<Dashboard />} />
        
        {/* Analysis/Upload page moved to /analyze */}
        <Route path="/analyze" element={<Index />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App