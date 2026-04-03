import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { authApi, type User } from '../api/auth'
import { AuthContext } from './authContext'

export { AuthContext } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Bootstrap: fetch user on mount. All setState calls are inside promise callbacks,
  // not in the synchronous effect body — satisfies react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false
    const token = localStorage.getItem('access_token')
    const req: Promise<User | null> = token
      ? authApi.me().then(({ data }) => data).catch(() => null)
      : Promise.resolve(null)

    req.then(userData => {
      if (cancelled) return
      if (userData) {
        setUser(userData)
      } else if (token) {
        setUser(null)
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
      }
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  const fetchUser = useCallback(async () => {
    try {
      const { data } = await authApi.me()
      setUser(data)
    } catch {
      setUser(null)
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }
  }, [])

  const login = async (access_token: string, refresh_token: string) => {
    localStorage.setItem('access_token', access_token)
    localStorage.setItem('refresh_token', refresh_token)
    await fetchUser()
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  )
}
