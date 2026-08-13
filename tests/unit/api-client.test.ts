import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  apiFetch,
  clearAccessToken,
  getAccessToken,
  getCurrentUser,
  setAccessToken,
} from '@/lib/api-client'

const tokenKey = 'dental_erp_access_token'

describe('FastAPI authentication client', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('stores and clears the access token', () => {
    setAccessToken('signed-token')
    expect(getAccessToken()).toBe('signed-token')
    expect(window.localStorage.getItem(tokenKey)).toBe('signed-token')

    clearAccessToken()
    expect(getAccessToken()).toBeNull()
  })

  it('adds the bearer token to FastAPI requests', async () => {
    setAccessToken('signed-token')
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }))

    await apiFetch('/api/auth/me')

    const headers = new Headers(fetchSpy.mock.calls[0][1]?.headers)
    expect(headers.get('Authorization')).toBe('Bearer signed-token')
  })

  it('does not overwrite an explicit authorization header', async () => {
    setAccessToken('stored-token')
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }))

    await apiFetch('/api/patients', {
      headers: { Authorization: 'Bearer explicit-token' },
    })

    const headers = new Headers(fetchSpy.mock.calls[0][1]?.headers)
    expect(headers.get('Authorization')).toBe('Bearer explicit-token')
  })

  it('returns null without contacting FastAPI when no token exists', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch')

    await expect(getCurrentUser()).resolves.toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('clears a rejected token', async () => {
    setAccessToken('expired-token')
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response(null, { status: 401 }))

    await expect(getCurrentUser()).resolves.toBeNull()
    expect(getAccessToken()).toBeNull()
  })
})
