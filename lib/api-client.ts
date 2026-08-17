'use client'

const ACCESS_TOKEN_KEY = 'dental_erp_access_token'

export interface AuthenticatedUser {
  id: string
  hospitalId: string
  email: string
  name: string
  roles: string[]
  permissions: string[]
  clinicName: string
  currency: string
  locale: string
  timezone: string
}

export function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function clearAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = getAccessToken()
  const headers = new Headers(init.headers)
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return window.fetch(input, { ...init, headers })
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const token = getAccessToken()
  if (!token) return null
  const response = await apiFetch('/api/auth/me')
  if (!response.ok) {
    clearAccessToken()
    return null
  }
  return response.json()
}

export function installAuthenticatedFetch() {
  if (typeof window === 'undefined' || Reflect.get(window, '__dentalFetchInstalled')) return
  const nativeFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const token = getAccessToken()
    if (!token || !url.startsWith('/api/')) return nativeFetch(input, init)
    const headers = new Headers(
      init.headers ?? (input instanceof Request ? input.headers : undefined)
    )
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
    return nativeFetch(input, { ...init, headers })
  }
  Reflect.set(window, '__dentalFetchInstalled', true)
}
