// Thin client for the WheelSync FastAPI backend.
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')
const TOKEN_KEY = 'wheelsync-customer-token'

export const apiUrl = API_URL
export const wsUrl = API_URL.replace(/^http/, 'ws')

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* storage unavailable */ }
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

let unauthorizedHandler = null
export const onUnauthorized = (handler) => { unauthorizedHandler = handler }

function messageFrom(data, fallback) {
  const detail = data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0]
    const field = Array.isArray(first.loc) ? first.loc.filter((p) => p !== 'body' && p !== 'query').join('.') : ''
    return field ? `${field}: ${first.msg}` : first.msg
  }
  return fallback
}

async function request(method, path, { body, form, query } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let payload
  if (form) payload = form // FormData: the browser sets the multipart boundary itself
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }

  let url = API_URL + path
  if (query) {
    const params = new URLSearchParams()
    Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') params.set(key, value) })
    const qs = params.toString()
    if (qs) url += (url.includes('?') ? '&' : '?') + qs
  }

  let response
  try {
    response = await fetch(url, { method, headers, body: payload })
  } catch {
    throw new ApiError(`Cannot reach the WheelSync server at ${API_URL}. Check your connection and that the API is running.`, 0)
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && token && unauthorizedHandler) unauthorizedHandler()
    throw new ApiError(messageFrom(data, `Request failed (HTTP ${response.status})`), response.status, data)
  }
  return data
}

export const api = {
  get: (path, query) => request('GET', path, { query }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
  upload: (path, form) => request('POST', path, { form }),
}
