import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Index from './pages/Index'
import Dashboard from './pages/Dashboard'
import ProjectDetails from './pages/ProjectDetails'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Dashboard (Project List) is the landing page */}
        <Route path="/" element={<Dashboard />} />
        
        {/* Analysis/Upload page */}
        <Route path="/analyze" element={<Index />} />
        
        {/* Project Details page */}
        <Route path="/project/:id" element={<ProjectDetails />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App