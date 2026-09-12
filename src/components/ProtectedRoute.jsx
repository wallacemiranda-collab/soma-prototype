import { Navigate, Outlet, useLocation } from 'react-router-dom'
import BrandMark from './BrandMark'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute() {
  const location = useLocation()
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="app-backdrop flex min-h-dvh items-center justify-center px-6">
        <div className="rounded-[1.75rem] bg-white p-6 shadow-card">
          <BrandMark compact />
          <p className="mt-4 text-sm text-soma-600">Carregando sua sessão...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
