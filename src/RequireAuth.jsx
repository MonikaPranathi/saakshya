import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

/**
 * Wraps a route and redirects to /login if the user is not authenticated.
 * Shows a teal spinner while Firebase determines auth state.
 */
export default function RequireAuth({ children }) {
  const user = useAuth()

  if (user === undefined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner spinner-teal" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
