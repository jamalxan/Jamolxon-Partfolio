import type { Problem, ProblemFieldError } from './types'

/** Admin API bazasi. `VITE_API_BASE` bilan o'zgartiriladi (default: `/api/v1/admin`). */
export const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) || '/api/v1/admin'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
/** 401 bo'lsa refresh qilinmaydigan yo'llar (ular o'zi auth oqimining qismi). */
const NO_REFRESH = ['/auth/login', '/auth/refresh', '/auth/2fa/setup', '/auth/2fa/verify', '/auth/logout']

export class ApiError extends Error {
  readonly status: number
  readonly problem: Problem
  readonly retryAfter: number | null

  constructor(problem: Problem, retryAfter: number | null = null) {
    super(problem.title || `HTTP ${problem.status}`)
    this.name = 'ApiError'
    this.status = problem.status
    this.problem = problem
    this.retryAfter = retryAfter
  }

  get type(): string {
    return this.problem.type
  }

  get fieldErrors(): ProblemFieldError[] {
    return this.problem.errors ?? []
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const parts = document.cookie ? document.cookie.split('; ') : []
  for (const part of parts) {
    const eq = part.indexOf('=')
    const key = eq === -1 ? part : part.slice(0, eq)
    if (key === name) return decodeURIComponent(part.slice(eq + 1))
  }
  return null
}

type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler = () => {}
/** Refresh ham 401 bersa chaqiriladi (login sahifasiga o'tkazish uchun). */
export function setUnauthorizedHandler(fn: UnauthorizedHandler) {
  onUnauthorized = fn
}

export type Query = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Query
  signal?: AbortSignal
  /** Javobni parse qilmasdan `Response` qaytarish (CSV yuklash uchun). */
  raw?: boolean
}

export function buildUrl(path: string, query?: Query): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  const url = new URL(API_BASE.replace(/\/$/, '') + path, origin)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue
      url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

let refreshPromise: Promise<boolean> | null = null

/** Bir vaqtda kelgan bir nechta 401 uchun faqat bitta refresh so'rovi yuboriladi. */
export function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = rawFetch('/auth/refresh', { method: 'POST' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

function rawFetch(path: string, opts: RequestOptions): Promise<Response> {
  const method = opts.method ?? 'GET'
  const headers = new Headers({ Accept: 'application/json, application/problem+json' })
  let body: BodyInit | undefined
  if (opts.body instanceof FormData) {
    body = opts.body
  } else if (opts.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(opts.body)
  }
  if (MUTATING.has(method)) {
    const csrf = readCookie('jx_csrf')
    if (csrf) headers.set('X-CSRF-Token', csrf)
  }
  return fetch(buildUrl(path, opts.query), {
    method,
    headers,
    body,
    credentials: 'include',
    signal: opts.signal,
  })
}

const GENERIC_TITLES: Record<number, string> = {
  400: "So'rov noto'g'ri",
  401: 'Avtorizatsiya talab qilinadi',
  403: "Ruxsat yo'q",
  404: 'Topilmadi',
  409: "Bu yozuv o'zgargan, yangilang",
  413: 'Fayl juda katta (10 MB gacha)',
  415: "Fayl turi qo'llab-quvvatlanmaydi",
  422: "Ma'lumot noto'g'ri",
  423: 'Hisob vaqtincha bloklangan',
  429: "Juda ko'p urinish",
}

export async function parseProblem(res: Response): Promise<Problem> {
  let data: Partial<Problem> | null = null
  const ct = res.headers.get('Content-Type') ?? ''
  if (ct.includes('json')) {
    try {
      data = (await res.json()) as Partial<Problem>
    } catch {
      data = null
    }
  }
  const status = res.status
  // Ichki xato matni foydalanuvchiga ko'rsatilmaydi (TZ 4).
  const fallbackTitle = status >= 500 ? "Serverda xato. Birozdan keyin urinib ko'ring" : GENERIC_TITLES[status] ?? 'Xato'
  return {
    type: typeof data?.type === 'string' ? data.type : status >= 500 ? 'internal_error' : 'error',
    title: status >= 500 ? fallbackTitle : typeof data?.title === 'string' && data.title ? data.title : fallbackTitle,
    status,
    errors: Array.isArray(data?.errors) ? data.errors : undefined,
    request_id: data?.request_id ?? res.headers.get('X-Request-ID') ?? undefined,
  }
}

function parseRetryAfter(res: Response): number | null {
  const h = res.headers.get('Retry-After')
  if (!h) return null
  const n = Number(h)
  if (Number.isFinite(n)) return Math.max(0, Math.round(n))
  const date = Date.parse(h)
  return Number.isNaN(date) ? null : Math.max(0, Math.round((date - Date.now()) / 1000))
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await rawFetch(path, opts)

  if (res.status === 401 && !NO_REFRESH.includes(path)) {
    const ok = await refreshSession()
    if (ok) {
      res = await rawFetch(path, opts)
    }
    if (!ok || res.status === 401) {
      onUnauthorized()
      throw new ApiError(await parseProblem(res))
    }
  }

  if (!res.ok) {
    throw new ApiError(await parseProblem(res), parseRetryAfter(res))
  }
  if (opts.raw) return res as unknown as T
  if (res.status === 204) return undefined as T
  const ct = res.headers.get('Content-Type') ?? ''
  if (!ct.includes('json')) return undefined as T
  return (await res.json()) as T
}

/** Ro'yxat javobi `{items}` yoki oddiy massiv bo'lishi mumkin — ikkalasini ham qabul qilamiz. */
export function asItems<T>(data: { items: T[] } | T[] | undefined | null): T[] {
  if (!data) return []
  return Array.isArray(data) ? data : data.items ?? []
}

/** Foydalanuvchiga ko'rsatiladigan xato matni. */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) {
    if (e.status === 409 && e.type === 'conflict') return "Bu yozuv o'zgargan, yangilang"
    if (e.status === 429) {
      return e.retryAfter != null
        ? `Juda ko'p urinish. ${e.retryAfter} soniyadan keyin qayta urinib ko'ring`
        : "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring"
    }
    if (e.status === 403 && e.type === 'csrf_failed') return "Xavfsizlik tokeni eskirgan. Sahifani yangilang"
    return e.problem.title
  }
  if (e instanceof TypeError) return "Server bilan aloqa yo'q. Internetni tekshiring"
  return "Kutilmagan xato"
}
