import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './authContext.js'
import { loginRequest, logoutRequest, registerRequest, restoreSession } from '../services/authApi.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')
  const [sessionError, setSessionError] = useState('')

  const applySession = useCallback((session) => {
    setUser(session?.user || null)
    setStatus(session ? 'authenticated' : 'anonymous')
    setSessionError('')
  }, [])

  useEffect(() => {
    let active = true
    restoreSession()
      .then((session) => {
        if (active) applySession(session)
      })
      .catch(() => {
        if (!active) return
        setStatus('anonymous')
        setSessionError('Could not connect to the authentication service. Check that the backend is running, then try again.')
      })
    return () => {
      active = false
    }
  }, [applySession])

  const login = useCallback(async (credentials, adminOnly = false) => {
    const session = await loginRequest(credentials, adminOnly)
    applySession(session)
    return session
  }, [applySession])

  const register = useCallback(async (details) => {
    return registerRequest(details)
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      applySession(null)
    }
  }, [applySession])

  const updateUser = useCallback((nextUser) => {
    setUser((current) => current ? { ...current, ...nextUser } : current)
  }, [])

  const value = useMemo(() => ({
    user,
    status,
    sessionError,
    login,
    register,
    logout,
    updateUser,
  }), [user, status, sessionError, login, register, logout, updateUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
