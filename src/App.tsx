import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Index from './pages/Index'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import ProjectDetails from './pages/ProjectDetails'

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Dashboard (Project List) is the landing page */}
          <Route path="/" element={<Landing />} />
          <Route path="/projects" element={<Dashboard />} />
          <Route path="/upload" element={<Index />} />
          
          {/* Analysis/Upload page */}
          <Route path="/analyze" element={<Index />} />
          
          {/* Project Details page */}
          <Route path="/project/:id" element={<ProjectDetails />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App