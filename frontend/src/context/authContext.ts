import { createContext } from 'react'
import type { User } from '../api/auth'

export interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (access_token: string, refresh_token: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
