const localHostname = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  ? window.location.hostname
  : 'localhost'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || `http://${localHostname}:4000/api`

let accessToken = null
let refreshInFlight = null

export function setAccessToken(token) {
  accessToken = token
}

async function request(path, { method = 'POST', body, authenticated = false } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (authenticated && accessToken) headers.Authorization = `Bearer ${accessToken}`

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 204) return null
  const responseBody = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(responseBody?.error?.message || 'The server could not complete the request.')
    error.status = response.status
    throw error
  }
  return responseBody
}

export async function loginRequest(credentials) {
  const session = await request('/auth/login', { body: credentials })
  setAccessToken(session.accessToken)
  return session
}

export async function registerRequest(details) {
  const session = await request('/auth/register', { body: details })
  setAccessToken(session.accessToken)
  return session
}

export function restoreSession() {
  if (!refreshInFlight) {
    refreshInFlight = request('/auth/refresh')
      .then((session) => {
        setAccessToken(session.accessToken)
        return session
      })
      .catch((error) => {
        setAccessToken(null)
        if (error.status === 401) return null
        throw error
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

export async function logoutRequest() {
  try {
    await request('/auth/logout')
  } finally {
    setAccessToken(null)
  }
}
