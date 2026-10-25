import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import RequireAuth from './RequireAuth'
import Navbar from './Navbar'
import Footer from './Footer'

import LoginPage from './pages/LoginPage'
import AddEvidencePage from './pages/AddEvidencePage'
import CertificatePage from './pages/CertificatePage'
import VerifyPage from './pages/VerifyPage'
import LockerPage from './pages/LockerPage'

function Layout() {
  const location = useLocation()
  const hideNav = location.pathname === '/login'

  return (
    <>
      {!hideNav && <Navbar />}

      <Routes>
        {/* Public */}
        <Route path="/login"       element={<LoginPage />} />
        <Route path="/verify/:id"  element={<VerifyPage />} />

        {/* Protected */}
        <Route path="/add"          element={<RequireAuth><AddEvidencePage /></RequireAuth>} />
        <Route path="/certificate/:id" element={<RequireAuth><CertificatePage /></RequireAuth>} />
        <Route path="/locker"       element={<RequireAuth><LockerPage /></RequireAuth>} />

        {/* Default */}
        <Route path="/"  element={<Navigate to="/add" replace />} />
        <Route path="*"  element={<Navigate to="/add" replace />} />
      </Routes>

      <Footer />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </AuthProvider>
  )
}
