import './native-globals'
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from '@/mocks/node'
import { resetMockDb } from '@/mocks/handlers'

// Lazy marshrutlar sekin CI/Windows'da birinchi marta kompilyatsiya qilinadi
configure({ asyncUtilTimeout: 20_000 })

// jsdom'da yo'q brauzer API'lari
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}
if (!('ResizeObserver' in window)) {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error polyfill
  window.ResizeObserver = RO
}

// jsdom AbortSignal'ini Node (undici) Request qabul qilmaydi (React Router data router + MSW).
// Testlarda signal'ni olib tashlaymiz.
{
  const NativeRequest = globalThis.Request
  class PatchedRequest extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      if (init?.signal) {
        const { signal: _s, ...rest } = init
        super(input, rest)
      } else {
        super(input, init)
      }
    }
  }
  globalThis.Request = PatchedRequest as typeof Request
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetMockDb()
  localStorage.clear()
})
afterAll(() => server.close())
