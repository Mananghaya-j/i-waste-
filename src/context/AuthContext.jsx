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

  const login = useCallback(async (credentials) => {
    const session = await loginRequest(credentials)
    applySession(session)
  }, [applySession])

  const register = useCallback(async (details) => {
    const session = await registerRequest(details)
    applySession(session)
  }, [applySession])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      applySession(null)
    }
  }, [applySession])

  const value = useMemo(() => ({
    user,
    status,
    sessionError,
    login,
    register,
    logout,
  }), [user, status, sessionError, login, register, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
