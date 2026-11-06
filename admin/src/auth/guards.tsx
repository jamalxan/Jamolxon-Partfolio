import * as React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from './AuthProvider'

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Yuklanmoqda">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (!user) {
    const next = location.pathname + location.search
    return <Navigate to={next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login'} replace />
  }
  return <Outlet />
}

/** Faqat owner uchun sahifalar (Sozlamalar, Foydalanuvchilar, Audit). Editor bosh sahifaga qaytariladi. */
export function RequireOwner() {
  const { isOwner } = useAuth()
  React.useEffect(() => {
    if (!isOwner) toast.error("Bu bo'limga faqat owner kira oladi")
  }, [isOwner])
  if (!isOwner) return <Navigate to="/" replace />
  return <Outlet />
}
