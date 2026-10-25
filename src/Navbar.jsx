import { Link, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from './firebase'
import { useAuth } from './AuthContext'
import { Shield, Plus, Archive, LogOut } from 'lucide-react'

export default function Navbar() {
  const user = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut(auth)
    navigate('/login')
  }

  const initial = user?.displayName?.[0]?.toUpperCase()
    || user?.email?.[0]?.toUpperCase()
    || '?'

  return (
    <nav className="navbar" aria-label="Main navigation">
      <div className="navbar-inner">
        {/* Brand */}
        <Link to={user ? '/add' : '/login'} className="navbar-brand" aria-label="Saakshya home">
          <Shield size={20} color="#F4A63A" strokeWidth={2.5} aria-hidden="true" />
          <span className="navbar-brand-text">Saak<span>shya</span></span>
        </Link>

        {/* Links — only when logged in */}
        {user && (
          <div className="navbar-links">
            <Link to="/add" className="nav-link" aria-label="Add evidence">
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
              <span className="nav-link-label">Add</span>
            </Link>
            <Link to="/locker" className="nav-link" aria-label="My locker">
              <Archive size={16} strokeWidth={2} aria-hidden="true" />
              <span className="nav-link-label">My Locker</span>
            </Link>
            <button
              className="btn-signout"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              <LogOut size={14} strokeWidth={2} aria-hidden="true" />
              <span className="nav-link-label">Sign out</span>
            </button>
            <div className="nav-avatar" aria-hidden="true" title={user.displayName || user.email}>
              {initial}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
