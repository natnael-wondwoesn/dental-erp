import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect method with Testing Library matchers
expect.extend(matchers)

// Cleanup after each test case
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  useParams: () => ({}),
}))

// Mock Next.js headers
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => new Headers(),
}))

// Mock environment variables
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/dental_erp_test'
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-testing'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.OPENROUTER_API_KEY = 'test-openrouter-api-key'
process.env.CRON_SECRET = 'test-cron-secret'
process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
process.env.TZ = 'Asia/Kolkata'

// Global fetch mock
global.fetch = vi.fn()

// The above mocks are DOM-only. Some suites opt into `@vitest-environment
// node` (no `window`) — for example tests exercising Next.js middleware,
// which needs a real Node `Request`/`Response` rather than jsdom's. Guard the
// rest of this file so it doesn't crash on load for those suites.
if (typeof window !== 'undefined') {
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // Provide window.localStorage.
  //
  // Bare jsdom exposes a working localStorage, but vitest's jsdom environment
  // re-defines the property without a getter, so reads return undefined while
  // sessionStorage keeps working. Install a real in-memory Storage so code under
  // test can round-trip values.
  class MemoryStorage implements Storage {
    private store = new Map<string, string>()

    get length() {
      return this.store.size
    }

    key(index: number) {
      return Array.from(this.store.keys())[index] ?? null
    }

    getItem(key: string) {
      return this.store.get(key) ?? null
    }

    setItem(key: string, value: string) {
      this.store.set(key, String(value))
    }

    removeItem(key: string) {
      this.store.delete(key)
    }

    clear() {
      this.store.clear()
    }
  }

  Object.defineProperty(window, 'localStorage', {
    writable: true,
    configurable: true,
    value: new MemoryStorage(),
  })

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
}
