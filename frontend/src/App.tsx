import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

// Pages
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import BotsPage from './pages/BotsPage'
import BotEditorPage from './pages/BotEditorPage'
import BotDetailPage from './pages/BotDetailPage'
import ArenasPage from './pages/ArenasPage'
import BattlePage from './pages/BattlePage'
import SessionResultPage from './pages/SessionResultPage'
import WalletPage from './pages/WalletPage'
import LeaderboardPage from './pages/LeaderboardPage'
import MatchesPage from './pages/MatchesPage'
import MatchLivePage from './pages/MatchLivePage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen surface-base flex items-center justify-center">
    <div className="text-primary animate-pulse font-display text-lg">Initializing...</div>
  </div>
  if (!user) return <Navigate to="/login" replace />
  if (!user.onboarding_completed) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user?.onboarding_completed) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/onboarding" element={<OnboardingPage />} />

      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/bots" element={<ProtectedRoute><BotsPage /></ProtectedRoute>} />
      <Route path="/bots/:id" element={<ProtectedRoute><BotDetailPage /></ProtectedRoute>} />
      <Route path="/bots/:id/edit" element={<ProtectedRoute><BotEditorPage /></ProtectedRoute>} />
      <Route path="/arenas" element={<ProtectedRoute><ArenasPage /></ProtectedRoute>} />
      <Route path="/battle" element={<ProtectedRoute><BattlePage /></ProtectedRoute>} />
      <Route path="/history/:sessionId" element={<ProtectedRoute><SessionResultPage /></ProtectedRoute>} />
      <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><LeaderboardPage /></ProtectedRoute>} />
      <Route path="/matches" element={<ProtectedRoute><MatchesPage /></ProtectedRoute>} />
      <Route path="/matches/:tableId" element={<ProtectedRoute><MatchLivePage /></ProtectedRoute>} />

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
