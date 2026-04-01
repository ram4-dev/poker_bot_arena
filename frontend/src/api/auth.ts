import api from './client'

export interface RegisterPayload {
  email: string
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface OnboardingPayload {
  username: string
  preset_key: string
}

export interface User {
  id: string
  email: string
  username: string | null
  balance: number
  locked_balance: number
  elo: number
  onboarding_completed: boolean
  created_at: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export const authApi = {
  register: (data: RegisterPayload) =>
    api.post<AuthResponse>('/auth/register', data),

  login: (data: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', data),

  refresh: (refresh_token: string) =>
    api.post<AuthResponse>('/auth/refresh', { refresh_token }),

  me: () => api.get<User>('/auth/me'),

  completeOnboarding: (data: OnboardingPayload) =>
    api.put<User>('/auth/onboarding', data),
}
