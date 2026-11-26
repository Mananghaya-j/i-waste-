import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Home from '../pages/Home.jsx'
import PickupPage from '../pages/PickupPage.jsx'
import ServicesPage from '../pages/ServicesPage.jsx'
import RecyclablesPage from '../pages/RecyclablesPage.jsx'
import TrackingPage from '../pages/TrackingPage.jsx'
import { AuthProvider } from '../context/AuthContext.jsx'
import { AdminLoginPage, LoginPage, RegisterPage } from '../pages/AuthPages.jsx'
import AdminPortal from '../pages/AdminPortal.jsx'
import RequestTrackingPage from '../pages/RequestTrackingPage.jsx'
import EnvironmentalReportsPage from '../pages/EnvironmentalReportsPage.jsx'
import CommunityPage from '../pages/CommunityPage.jsx'
import ProfilePage from '../pages/ProfilePage.jsx'
import { useAuth } from '../hooks/useAuth.js'
import '../styles/App.css'

const MODAL_PATHS = new Set(['/login', '/register', '/admin/login', '/profile'])

function roleHome(role) {
  if (role === 'SUPER_ADMIN') return '/super-admin'
  if (role === 'ADMIN') return '/admin'
  return '/'
}

function ResidentAccess({ children }) {
  const { user, status } = useAuth()
  if (status === 'loading') return <main className="auth-route-loading" role="status">Restoring your session…</main>
  if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
    return <Navigate to={roleHome(user.role)} replace />
  }
  return children
}

function AppRoutes() {
  const location = useLocation()
  const { user } = useAuth()
  const isModalPath = MODAL_PATHS.has(location.pathname)
  const backgroundLocation = location.state?.backgroundLocation
  const fallbackBackground = { pathname: roleHome(user?.role) }
  const pageLocation = isModalPath ? backgroundLocation || fallbackBackground : location

  return (
    <>
      <Routes location={pageLocation}>
        <Route path="/" element={<ResidentAccess><Home /></ResidentAccess>} />
        <Route path="/tracking" element={<ResidentAccess><TrackingPage /></ResidentAccess>} />
        <Route path="/request-tracking" element={<ResidentAccess><RequestTrackingPage /></ResidentAccess>} />
        <Route path="/pickup" element={<ResidentAccess><PickupPage /></ResidentAccess>} />
        <Route path="/tree-waterways" element={<ResidentAccess><ServicesPage /></ResidentAccess>} />
        <Route path="/recyclables" element={<ResidentAccess><RecyclablesPage /></ResidentAccess>} />
        <Route path="/community" element={<ResidentAccess><CommunityPage /></ResidentAccess>} />
        <Route path="/reports" element={<ResidentAccess><EnvironmentalReportsPage /></ResidentAccess>} />
        <Route path="/about" element={<ResidentAccess><Home /></ResidentAccess>} />
        <Route path="/admin" element={<AdminPortal />} />
        <Route path="/admin/*" element={<AdminPortal />} />
        <Route path="/super-admin" element={<AdminPortal />} />
        <Route path="/super-admin/*" element={<AdminPortal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {isModalPath && (
        <Routes location={location}>
          <Route path="/login" element={<LoginPage modal />} />
          <Route path="/register" element={<RegisterPage modal />} />
          <Route path="/admin/login" element={<AdminLoginPage modal />} />
          <Route path="/profile" element={<ProfilePage modal />} />
        </Routes>
      )}
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
