// src/main.tsx (or src/index.tsx) - COMPLETE CONTENT

import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Index from './pages/Index.tsx'
import Dashboard from './pages/Dashboard.tsx' // New import for the Dashboard

import './index.css' // Assuming your global CSS is here

// Define the routes for the application
const router = createBrowserRouter([
  {
    path: "/",
    element: <Dashboard />, // The main route will now be the Dashboard
  },
  {
    path: "/analyze",
    element: <Index />, // The analysis tool will be under /analyze
  },
  // Optionally, you might put the Index component directly under the root, 
  // but using a dashboard is better for future project management.
]);


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="min-h-screen bg-slate-50">
        <RouterProvider router={router} />
    </div>
  </React.StrictMode>,
)