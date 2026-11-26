const configuredApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL
const API_BASE_URL = (configuredApiUrl || '/api').replace(/\/+$/, '')
const apiUrl = new URL(API_BASE_URL, window.location.origin)
if (!['http:', 'https:'].includes(apiUrl.protocol)) {
  throw new Error('VITE_API_URL must use HTTP or HTTPS.')
}
if (import.meta.env.PROD && window.location.protocol === 'https:' && apiUrl.protocol !== 'https:') {
  throw new Error('The production API must use HTTPS.')
}

let accessToken = null
let refreshInFlight = null

export function setAccessToken(token) {
  accessToken = token
}

async function request(path, { method = 'POST', body, authenticated = false, responseType = 'json' } = {}) {
  const headers = {}
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json'
  if (authenticated && accessToken) headers.Authorization = `Bearer ${accessToken}`

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  })

  if (response.status === 204) return null
  const responseBody = response.ok
    ? responseType === 'blob' ? await response.blob() : await response.json().catch(() => null)
    : await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(responseBody?.error?.message || 'The server could not complete the request.')
    error.status = response.status
    throw error
  }
  return responseBody
}

export async function loginRequest(credentials, adminOnly = false) {
  const session = await request(adminOnly ? '/auth/admin/login' : '/auth/login', { body: credentials })
  setAccessToken(session.accessToken)
  return session
}

export async function registerRequest(details) {
  return request('/auth/register', { body: details })
}

export async function authenticatedRequest(path, { method = 'GET', body } = {}) {
  return request(path, { method, body, authenticated: true })
}

export async function publicRequest(path) {
  return request(path, { method: 'GET' })
}

export async function publicMultipartRequest(path, formData) {
  return request(path, {
    method: 'POST',
    body: formData,
    authenticated: Boolean(accessToken),
  })
}

export async function authenticatedDownload(path) {
  return request(path, { method: 'GET', authenticated: true, responseType: 'blob' })
}

export async function authenticatedUpload(path, formData, method = 'PATCH') {
  return request(path, { method, body: formData, authenticated: true })
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
