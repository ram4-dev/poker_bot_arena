import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

// Pages
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DocsPage from './pages/DocsPage'
import DashboardPage from './pages/DashboardPage'
import AgentHistoryPage from './pages/AgentHistoryPage'
import ArenasPage from './pages/ArenasPage'
import LeaderboardPage from './pages/LeaderboardPage'
import WalletPage from './pages/WalletPage'
import MatchesPage from './pages/MatchesPage'
import MatchLivePage from './pages/MatchLivePage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen surface-base flex items-center justify-center">
    <div className="text-primary animate-pulse font-display text-lg">Initializing...</div>
  </div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/skill" element={<DocsPage />} />

      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/agents/:id/history" element={<ProtectedRoute><AgentHistoryPage /></ProtectedRoute>} />
      <Route path="/matches" element={<ProtectedRoute><MatchesPage /></ProtectedRoute>} />
      <Route path="/matches/:tableId" element={<ProtectedRoute><MatchLivePage /></ProtectedRoute>} />
      <Route path="/arenas" element={<ProtectedRoute><ArenasPage /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
      <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
