import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '@/mocks/node'
import { B, loginAs, session } from '@/mocks/handlers'
import { api, ApiError, errorMessage, setUnauthorizedHandler } from './api'

describe('api client', () => {
  it("o'zgartiruvchi so'rovlarga jx_csrf cookie'dan X-CSRF-Token qo'shadi, GET ga qo'shmaydi", async () => {
    loginAs('u-owner')
    const seen: Record<string, string | null> = {}
    server.use(
      http.get(`${B}/ping`, ({ request }) => {
        seen.get = request.headers.get('X-CSRF-Token')
        seen.getCreds = request.credentials
        return HttpResponse.json({ ok: true })
      }),
      http.post(`${B}/ping`, ({ request }) => {
        seen.post = request.headers.get('X-CSRF-Token')
        return HttpResponse.json({ ok: true })
      }),
    )
    await api('/ping')
    await api('/ping', { method: 'POST', body: { a: 1 } })
    expect(seen.get).toBeNull()
    expect(seen.getCreds).toBe('include')
    expect(seen.post).toBe(session.csrf)
    expect(seen.post).toMatch(/^csrf-/)
  })

  it('401 da bir marta /auth/refresh chaqiradi va so‘rovni takrorlaydi', async () => {
    loginAs('u-owner')
    session.accessExpired = true
    let refreshCalls = 0
    let projectCalls = 0
    server.use(
      http.post(`${B}/auth/refresh`, () => {
        refreshCalls += 1
        session.accessExpired = false
        return HttpResponse.json({ user: { id: 'u-owner' } })
      }),
      http.get(`${B}/thing`, () => {
        projectCalls += 1
        if (session.accessExpired) return HttpResponse.json({ type: 'unauthorized', title: 'x', status: 401 }, { status: 401 })
        return HttpResponse.json({ ok: 1 })
      }),
    )
    await expect(api('/thing')).resolves.toEqual({ ok: 1 })
    expect(refreshCalls).toBe(1)
    expect(projectCalls).toBe(2)
  })

  it('refresh ham 401 bersa, unauthorized handler chaqiriladi (login sahifasiga)', async () => {
    const onUnauth = vi.fn()
    setUnauthorizedHandler(onUnauth)
    let refreshCalls = 0
    server.use(
      http.post(`${B}/auth/refresh`, () => {
        refreshCalls += 1
        return HttpResponse.json({ type: 'unauthorized', title: 'x', status: 401 }, { status: 401 })
      }),
      http.get(`${B}/thing`, () => HttpResponse.json({ type: 'unauthorized', title: 'x', status: 401 }, { status: 401 })),
    )
    await expect(api('/thing')).rejects.toBeInstanceOf(ApiError)
    expect(refreshCalls).toBe(1)
    expect(onUnauth).toHaveBeenCalledTimes(1)
    setUnauthorizedHandler(() => {})
  })

  it("bir vaqtdagi 401'lar uchun faqat bitta refresh yuboriladi", async () => {
    loginAs('u-owner')
    session.accessExpired = true
    let refreshCalls = 0
    server.use(
      http.post(`${B}/auth/refresh`, async () => {
        refreshCalls += 1
        await new Promise((r) => setTimeout(r, 20))
        session.accessExpired = false
        return HttpResponse.json({ user: {} })
      }),
    )
    await Promise.all([api('/projects'), api('/services'), api('/posts')])
    expect(refreshCalls).toBe(1)
  })

  it('RFC 9457 problem va Retry-After ni parse qiladi', async () => {
    server.use(
      http.post(`${B}/x`, () =>
        HttpResponse.json(
          { type: 'validation_error', title: "Ma'lumot noto'g'ri", status: 422, errors: [{ field: 'slug', msg: 'band' }], request_id: 'r1' },
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
      http.get(`${B}/y`, () => HttpResponse.json({ type: 'rate_limited', title: 'x', status: 429 }, { status: 429, headers: { 'Retry-After': '30' } })),
      http.get(`${B}/z`, () => HttpResponse.json({ type: 'internal_error', title: 'Traceback: secret', status: 500 }, { status: 500 })),
    )
    const fail = (p: Promise<unknown>): Promise<ApiError> => p.then(() => Promise.reject(new Error('xato kutilgan')), (e: ApiError) => e)
    const e1 = await fail(api('/x', { method: 'POST', body: {} }))
    expect(e1.status).toBe(422)
    expect(e1.fieldErrors).toEqual([{ field: 'slug', msg: 'band' }])
    expect(e1.problem.request_id).toBe('r1')
    const e2 = await fail(api('/y'))
    expect(e2.retryAfter).toBe(30)
    expect(errorMessage(e2)).toContain('30 soniyadan keyin')
    const e3 = await fail(api('/z'))
    // Ichki xato matni ko'rsatilmaydi
    expect(errorMessage(e3)).not.toContain('Traceback')
  })

  it("409 conflict uchun o'zbekcha xabar", () => {
    const e = new ApiError({ type: 'conflict', title: 'Conflict', status: 409 })
    expect(errorMessage(e)).toBe("Bu yozuv o'zgargan, yangilang")
  })
})
