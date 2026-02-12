import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'
import Index from './pages/Index'
import Dashboard from './pages/Dashboard'
import ProjectDetails from './pages/ProjectDetails'
import Landing from './pages/Landing'
import AccessRestricted from './pages/AccessRestricted'
import { useAccessControl } from './hooks/useAccessControl'
import { ErrorBoundary } from './components/ErrorBoundary'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Access guard - checks if user's email is on the allowlist
function AccessGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isAllowed } = useAccessControl()

  // Wait for user data to load
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // If not allowed, show access restricted page
  if (!isAllowed) {
    return <AccessRestricted />
  }

  return <>{children}</>
}

// Protected route wrapper - requires auth + allowlist
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>
        <AccessGuard>{children}</AccessGuard>
      </SignedIn>
      <SignedOut><RedirectToSignIn /></SignedOut>
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            {/* Landing page for signed-out users, redirect to dashboard for signed-in */}
            <Route path="/" element={
              <>
                <SignedIn><Navigate to="/projects" replace /></SignedIn>
                <SignedOut><Landing /></SignedOut>
              </>
            } />
            <Route path="/projects" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/analyze" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/new-project" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/project/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />

            {/* Access restricted page - accessible when signed in but not allowed */}
            <Route path="/access-restricted" element={
              <SignedIn><AccessRestricted /></SignedIn>
            } />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
