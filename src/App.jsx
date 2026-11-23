import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from '../frontend/Home.jsx'
import PickupPage from '../frontend/PickupPage.jsx'
import ServicesPage from '../frontend/ServicesPage.jsx'
import RecyclablesPage from '../frontend/RecyclablesPage.jsx'
import TrackingPage from '../frontend/TrackingPage.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { LoginPage, RegisterPage } from './pages/AuthPages.jsx'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tracking" element={<TrackingPage />} />
          <Route path="/pickup" element={<PickupPage />} />
          <Route path="/tree-waterways" element={<ServicesPage />} />
          <Route path="/recyclables" element={<RecyclablesPage />} />
          <Route path="/community" element={<Home />} />
          <Route path="/reports" element={<Home />} />
          <Route path="/about" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
