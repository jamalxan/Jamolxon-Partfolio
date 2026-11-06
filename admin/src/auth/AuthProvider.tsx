import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, isApiError, setUnauthorizedHandler } from '@/lib/api'
import type { User } from '@/lib/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  isOwner: boolean
  setUser: (u: User | null) => void
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export const ME_KEY = ['auth', 'me'] as const

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await api<User>('/auth/me')
      } catch (e) {
        if (isApiError(e) && e.status === 401) return null
        throw e
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })

  const setUser = React.useCallback(
    (u: User | null) => {
      qc.setQueryData(ME_KEY, u)
    },
    [qc],
  )

  React.useEffect(() => {
    // Refresh ham 401 qaytarsa: sessiya tugagan, login sahifasiga.
    setUnauthorizedHandler(() => {
      qc.setQueryData(ME_KEY, null)
    })
    return () => setUnauthorizedHandler(() => {})
  }, [qc])

  const logout = React.useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } finally {
      qc.clear()
      qc.setQueryData(ME_KEY, null)
    }
  }, [qc])

  const user = me.data ?? null
  const value = React.useMemo<AuthContextValue>(
    () => ({ user, loading: me.isPending, isOwner: user?.role === 'owner', setUser, logout }),
    [user, me.isPending, setUser, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth AuthProvider ichida ishlatilishi kerak')
  return ctx
}
