/**
 * MSW handlerlari: docs/API.md kontraktini xotiradagi bazada amalga oshiradi.
 * Testlarda va `npm run dev:mock` da ishlatiladi.
 */
import { http, HttpResponse, type DefaultBodyType, type StrictRequest } from 'msw'
import type { AuditLog, Lead, LeadStatus, Media, Problem, User } from '@/lib/types'
import { SLUG_RE } from '@/lib/schemas'
import * as seed from './seed'

export const B = '*/api/v1/admin'

type Row = Record<string, unknown> & { id: string }

function freshDb() {
  return {
    users: seed.seedUsers(),
    projects: seed.seedProjects() as unknown as Row[],
    services: seed.seedServices() as unknown as Row[],
    posts: seed.seedPosts() as unknown as Row[],
    categories: seed.seedCategories() as unknown as Row[],
    tags: seed.seedTags() as unknown as Row[],
    offers: seed.seedOffers() as unknown as Row[],
    steps: seed.seedSteps() as unknown as Row[],
    leads: seed.seedLeads(),
    media: seed.seedMedia(),
    settings: seed.seedSettings(),
    redirects: seed.seedRedirects(),
    audit: seed.seedAudit(),
  }
}

export const db = freshDb()

export const session: { pre: string | null; userId: string | null; csrf: string | null; accessExpired: boolean } = {
  pre: null,
  userId: null,
  csrf: null,
  accessExpired: false,
}

/** Testlar orasida holatni tiklash. */
export function resetMockDb() {
  Object.assign(db, freshDb())
  session.pre = null
  session.userId = null
  session.csrf = null
  session.accessExpired = false
  setCsrfCookie(null)
}

/** Testlar uchun: tayyor sessiya bilan boshlash. */
export function loginAs(userId: 'u-owner' | 'u-editor' | string) {
  session.userId = userId
  session.accessExpired = false
  session.csrf = `csrf-${Math.random().toString(36).slice(2)}`
  setCsrfCookie(session.csrf)
}

function setCsrfCookie(v: string | null) {
  if (typeof document === 'undefined') return
  document.cookie = v ? `jx_csrf=${encodeURIComponent(v)}; path=/` : 'jx_csrf=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

const now = (() => {
  let last = 0
  // Har chaqiriqda farqli vaqt (optimistik qulf uchun)
  return () => {
    const t = Math.max(Date.now(), last + 1)
    last = t
    return new Date(t).toISOString()
  }
})()

function problem(status: number, type: string, title: string, errors?: { field: string; msg: string }[], headers?: Record<string, string>) {
  const body: Problem = { type, title, status, errors, request_id: 'mock-' + Math.random().toString(36).slice(2, 8) }
  return HttpResponse.json(body, { status, headers: { 'Content-Type': 'application/problem+json', ...headers } })
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Sessiya + CSRF tekshiruvi. Muvaffaqiyatsiz bo'lsa Response qaytaradi. */
function guard(request: StrictRequest<DefaultBodyType>, opts: { owner?: boolean } = {}): { user: seed.MockUser } | { res: Response } {
  if (!session.userId || session.accessExpired) return { res: problem(401, 'unauthorized', 'Avtorizatsiya talab qilinadi') }
  const user = db.users.find((u) => u.id === session.userId)
  if (!user || !user.is_active) return { res: problem(401, 'unauthorized', 'Avtorizatsiya talab qilinadi') }
  if (MUTATING.has(request.method) && request.headers.get('X-CSRF-Token') !== session.csrf) {
    return { res: problem(403, 'csrf_failed', 'CSRF token noto‘g‘ri') }
  }
  if (opts.owner && user.role !== 'owner') return { res: problem(403, 'forbidden', "Ruxsat yo'q") }
  return { user }
}

function publicUser(u: seed.MockUser): User {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = u
  return rest
}

function paginate<T>(items: T[], url: URL) {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 12) || 12))
  return { items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit }
}

function audit(user: seed.MockUser, action: string, entity: string, entityId: string | null, diff: unknown) {
  const entry: AuditLog = { id: seed.uid(), actor: { id: user.id, email: user.email }, action, entity, entity_id: entityId, diff, ip: '127.0.0.1', created_at: now() }
  db.audit.unshift(entry)
}

function diffOf(before: Row, after: Row) {
  const d: Record<string, [unknown, unknown]> = {}
  for (const k of Object.keys(after)) {
    if (k === 'updated_at') continue
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) d[k] = [before[k], after[k]]
  }
  return d
}

// ---------- validatsiya (backend Pydantic qoidalariga mos) ----------
const CONTENT = ['projects', 'services', 'posts', 'categories', 'tags', 'offers', 'steps'] as const
type ContentRes = (typeof CONTENT)[number]
const PUBLISHABLE: ContentRes[] = ['projects', 'services', 'posts']

const ALLOWED: Record<ContentRes, string[]> = {
  projects: ['slug', 'title', 'subtitle', 'category', 'url', 'year', 'role', 'stack', 'summary', 'sections', 'results', 'links', 'illo', 'image', 'cover_id', 'gallery', 'seo_title', 'seo_description', 'is_featured'],
  services: ['slug', 'title', 'icon', 'illo', 'short', 'who', 'includes', 'process', 'examples', 'stack', 'timeline', 'faq', 'price_from', 'duration', 'seo_title', 'seo_description'],
  posts: ['slug', 'title', 'excerpt', 'body_md', 'tags', 'cover_id', 'seo_title', 'seo_description'],
  categories: ['slug', 'title', 'short', 'badge', 'dot', 'description', 'color'],
  tags: ['slug', 'title'],
  offers: ['key', 'title', 'icon', 'problem', 'solution', 'examples'],
  steps: ['title', 'text', 'get'],
}

function validate(res: ContentRes, body: Record<string, unknown>, existingId: string | null, partial: boolean) {
  const errors: { field: string; msg: string }[] = []
  for (const k of Object.keys(body)) {
    if (k !== 'updated_at' && !ALLOWED[res].includes(k)) errors.push({ field: k, msg: "Noma'lum maydon" })
  }
  const slugField = res === 'offers' ? 'key' : res === 'steps' ? null : 'slug'
  if (slugField && (!partial || slugField in body)) {
    const v = body[slugField]
    if (typeof v !== 'string' || !SLUG_RE.test(v)) errors.push({ field: slugField, msg: "Slug faqat kichik lotin harflari, raqam va '-' dan iborat bo'lsin" })
    else if ((db[res] as Row[]).some((r) => r[slugField] === v && r.id !== existingId)) errors.push({ field: slugField, msg: 'Bu slug band' })
  }
  if (!partial || 'title' in body) {
    const t = body.title
    if (typeof t !== 'string' || t.trim().length < 2) errors.push({ field: 'title', msg: 'Sarlavha majburiy (kamida 2 belgi)' })
    else if (t.length > 120) errors.push({ field: 'title', msg: 'Sarlavha 120 belgidan oshmasin' })
  }
  if (typeof body.seo_title === 'string' && body.seo_title.length > 60) errors.push({ field: 'seo_title', msg: 'SEO sarlavha 60 belgidan oshmasin' })
  if (typeof body.seo_description === 'string' && body.seo_description.length > 155) errors.push({ field: 'seo_description', msg: 'SEO tavsif 155 belgidan oshmasin' })
  return errors
}

function derive(res: ContentRes, row: Row) {
  if (res === 'posts') {
    const md = String(row.body_md ?? '')
    row.reading_min = Math.max(1, Math.round(md.split(/\s+/).filter(Boolean).length / 200))
    row.body_html = md ? `<p>${md.replace(/</g, '&lt;')}</p>` : ''
  }
}

function contentHandlers(res: ContentRes) {
  const table = () => db[res] as Row[]
  const pub = PUBLISHABLE.includes(res)
  return [
    http.get(`${B}/${res}`, ({ request }) => {
      const g = guard(request)
      if ('res' in g) return g.res
      const url = new URL(request.url)
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      const status = url.searchParams.get('status')
      let items = table().filter((r) => !r.deleted_at)
      if (q) items = items.filter((r) => [r.title, r.slug, r.key].some((v) => typeof v === 'string' && v.toLowerCase().includes(q)))
      if (status && pub) items = items.filter((r) => r.status === status)
      items = items.slice().sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
      return HttpResponse.json(paginate(items, url))
    }),
    http.post(`${B}/${res}/reorder`, async ({ request }) => {
      const g = guard(request)
      if ('res' in g) return g.res
      const { ids } = (await request.json()) as { ids: string[] }
      ids.forEach((id, i) => {
        const r = table().find((x) => x.id === id)
        if (r) r.sort_order = i
      })
      audit(g.user, 'reorder', res, null, { ids })
      return new HttpResponse(null, { status: 204 })
    }),
    http.post(`${B}/${res}`, async ({ request }) => {
      const g = guard(request)
      if ('res' in g) return g.res
      const body = (await request.json()) as Record<string, unknown>
      const errors = validate(res, body, null, false)
      if (errors.length) return problem(422, 'validation_error', "Ma'lumot noto'g'ri", errors)
      const t = now()
      const row: Row = { ...body, id: seed.uid(), sort_order: table().length, created_at: t, updated_at: t }
      if (pub) Object.assign(row, { status: 'draft', published_at: null })
      derive(res, row)
      table().push(row)
      audit(g.user, 'create', res, row.id, { after: body })
      return HttpResponse.json(row, { status: 201 })
    }),
    http.get(`${B}/${res}/:id`, ({ request, params }) => {
      const g = guard(request)
      if ('res' in g) return g.res
      const row = table().find((r) => r.id === params.id && !r.deleted_at)
      return row ? HttpResponse.json(row) : problem(404, 'not_found', 'Topilmadi')
    }),
    http.patch(`${B}/${res}/:id`, async ({ request, params }) => {
      const g = guard(request)
      if ('res' in g) return g.res
      const row = table().find((r) => r.id === params.id && !r.deleted_at)
      if (!row) return problem(404, 'not_found', 'Topilmadi')
      const body = (await request.json()) as Record<string, unknown>
      if (row.updated_at && body.updated_at !== row.updated_at) return problem(409, 'conflict', "Bu yozuv o'zgargan, yangilang")
      const errors = validate(res, body, row.id, true)
      if (errors.length) return problem(422, 'validation_error', "Ma'lumot noto'g'ri", errors)
      const before = { ...row }
      const { updated_at: _u, ...patch } = body
      Object.assign(row, patch, { updated_at: now() })
      derive(res, row)
      audit(g.user, 'update', res, row.id, diffOf(before, row))
      return HttpResponse.json(row)
    }),
    http.delete(`${B}/${res}/:id`, ({ request, params }) => {
      const g = guard(request)
      if ('res' in g) return g.res
      const row = table().find((r) => r.id === params.id && !r.deleted_at)
      if (!row) return problem(404, 'not_found', 'Topilmadi')
      row.deleted_at = now()
      audit(g.user, 'delete', res, row.id, null)
      return new HttpResponse(null, { status: 204 })
    }),
    ...(pub
      ? [
          http.post(`${B}/${res}/:id/publish`, async ({ request, params }) => {
            const g = guard(request)
            if ('res' in g) return g.res
            const row = table().find((r) => r.id === params.id && !r.deleted_at)
            if (!row) return problem(404, 'not_found', 'Topilmadi')
            const { status, published_at } = (await request.json()) as { status: string; published_at: string | null }
            if (!['draft', 'published', 'archived'].includes(status)) return problem(422, 'validation_error', "Ma'lumot noto'g'ri", [{ field: 'status', msg: "Noto'g'ri status" }])
            const before = { ...row }
            row.status = status
            if (status === 'published') row.published_at = published_at ?? row.published_at ?? now()
            row.updated_at = now()
            audit(g.user, 'publish', res, row.id, diffOf(before, row))
            return HttpResponse.json(row)
          }),
          http.post(`${B}/${res}/:id/preview`, ({ request, params }) => {
            const g = guard(request)
            if ('res' in g) return g.res
            return HttpResponse.json({ url: `https://jamolxon.uz/preview/mock-${String(params.id)}` })
          }),
        ]
      : []),
  ]
}

// ---------- auth ----------
const authHandlers = [
  http.post(`${B}/auth/login`, async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string }
    if (email === 'locked@jamolxon.uz') return problem(423, 'locked', 'Hisob bloklangan')
    if (email === 'ratelimit@jamolxon.uz') return problem(429, 'rate_limited', "Juda ko'p urinish", undefined, { 'Retry-After': '120' })
    const u = db.users.find((x) => x.email === email.toLowerCase() && x.is_active)
    if (!u || u.password !== password) return problem(401, 'unauthorized', "Email yoki parol noto'g'ri")
    session.pre = u.id
    return HttpResponse.json({ status: u.totp_enabled ? '2fa_required' : '2fa_setup_required' })
  }),
  http.post(`${B}/auth/2fa/setup`, () => {
    const u = db.users.find((x) => x.id === session.pre)
    if (!u) return problem(401, 'unauthorized', 'Sessiya muddati tugagan')
    if (u.totp_enabled) return problem(403, 'forbidden', '2FA allaqachon yoqilgan')
    return HttpResponse.json({ secret: 'JBSWY3DPEHPK3PXP', otpauth_url: `otpauth://totp/jamolxon.uz:${u.email}?secret=JBSWY3DPEHPK3PXP&issuer=jamolxon.uz` })
  }),
  http.post(`${B}/auth/2fa/verify`, async ({ request }) => {
    const u = db.users.find((x) => x.id === session.pre)
    if (!u) return problem(401, 'unauthorized', 'Sessiya muddati tugagan')
    const body = (await request.json()) as { code?: string; backup_code?: string }
    const ok = body.code === seed.MOCK_TOTP || (u.totp_enabled && body.backup_code === seed.MOCK_BACKUP_CODE)
    if (!ok) return problem(422, 'validation_error', "Kod noto'g'ri", [{ field: body.code ? 'code' : 'backup_code', msg: "Kod noto'g'ri" }])
    const first = !u.totp_enabled
    u.totp_enabled = true
    u.last_login_at = now()
    session.pre = null
    loginAs(u.id)
    const backup_codes = first ? Array.from({ length: 10 }, (_, i) => `k${i}x${i}-${1000 + i * 111}`) : null
    return HttpResponse.json({ user: publicUser(u), backup_codes })
  }),
  http.post(`${B}/auth/refresh`, () => {
    if (!session.userId) return problem(401, 'unauthorized', 'Sessiya tugagan')
    const u = db.users.find((x) => x.id === session.userId)
    if (!u) return problem(401, 'unauthorized', 'Sessiya tugagan')
    loginAs(u.id) // rotation: yangi CSRF
    return HttpResponse.json({ user: publicUser(u) })
  }),
  http.post(`${B}/auth/logout`, () => {
    session.userId = null
    session.csrf = null
    setCsrfCookie(null)
    return new HttpResponse(null, { status: 204 })
  }),
  http.get(`${B}/auth/me`, ({ request }) => {
    const g = guard(request)
    if ('res' in g) return g.res
    return HttpResponse.json(publicUser(g.user))
  }),
  http.post(`${B}/auth/password`, async ({ request }) => {
    const g = guard(request)
    if ('res' in g) return g.res
    const { current_password, new_password } = (await request.json()) as { current_password: string; new_password: string }
    if (current_password !== g.user.password) return problem(422, 'validation_error', "Ma'lumot noto'g'ri", [{ field: 'current_password', msg: "Joriy parol noto'g'ri" }])
    if (!new_password || new_password.length < 12) return problem(422, 'validation_error', "Ma'lumot noto'g'ri", [{ field: 'new_password', msg: 'Parol kamida 12 belgi' }])
    g.user.password = new_password
    return new HttpResponse(null, { status: 204 })
  }),
]

// ---------- media ----------
const MEDIA_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']
const mediaHandlers = [
  http.get(`${B}/media`, ({ request }) => {
    const g = guard(request)
    if ('res' in g) return g.res
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const items = db.media.filter((m) => !q || m.alt.toLowerCase().includes(q) || m.original_name.toLowerCase().includes(q))
    return HttpResponse.json(paginate(items, url))
  }),
  http.post(`${B}/media`, async ({ request }) => {
    const g = guard(request)
    if ('res' in g) return g.res
    let file: File | null = null
    let alt = ''
    try {
      const fd = await request.formData()
      const f = fd.get('file')
      file = f && typeof f === 'object' ? (f as File) : null
      alt = String(fd.get('alt') ?? '')
    } catch {
      return problem(422, 'validation_error', "Ma'lumot noto'g'ri", [{ field: 'file', msg: 'Fayl majburiy' }])
    }
    const errors: { field: string; msg: string }[] = []
    if (!alt.trim()) errors.push({ field: 'alt', msg: 'Alt matn majburiy' })
    if (!file) errors.push({ field: 'file', msg: 'Fayl majburiy' })
    if (errors.length) return problem(422, 'validation_error', "Ma'lumot noto'g'ri", errors)
    if (file!.size > 10 * 1024 * 1024) return problem(413, 'payload_too_large', 'Fayl juda katta')
    if (file!.type && !MEDIA_MIME.includes(file!.type)) return problem(415, 'unsupported_media', "Fayl turi qo'llab-quvvatlanmaydi")
    const m: Media = {
      id: seed.uid(),
      url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720"><rect width="100%" height="100%" fill="#3a0509"/></svg>'),
      original_name: file!.name || 'fayl',
      mime: file!.type || 'image/png',
      size_bytes: file!.size,
      width: 960,
      height: 720,
      variants: {},
      alt: alt.trim(),
      blurhash: null,
      used_in: [],
      created_at: now(),
    }
    db.media.unshift(m)
    audit(g.user, 'create', 'media', m.id, { after: { alt: m.alt, original_name: m.original_name } })
    return HttpResponse.json(m, { status: 201 })
  }),
  http.patch(`${B}/media/:id`, async ({ request, params }) => {
    const g = guard(request)
    if ('res' in g) return g.res
    const m = db.media.find((x) => x.id === params.id)
    if (!m) return problem(404, 'not_found', 'Topilmadi')
    const { alt } = (await request.json()) as { alt: string }
    if (!alt?.trim()) return problem(422, 'validation_error', "Ma'lumot noto'g'ri", [{ field: 'alt', msg: 'Alt matn majburiy' }])
    m.alt = alt.trim()
    return HttpResponse.json(m)
  }),
  http.delete(`${B}/media/:id`, ({ request, params }) => {
    const g = guard(request)
    if ('res' in g) return g.res
    const m = db.media.find((x) => x.id === params.id)
    if (!m) return problem(404, 'not_found', 'Topilmadi')
    if (m.used_in.length) return problem(409, 'conflict', 'Fayl ishlatilmoqda')
    db.media = db.media.filter((x) => x.id !== m.id)
    return new HttpResponse(null, { status: 204 })
  }),
]

// ---------- leads ----------
const leadHandlers = [
  http.get(`${B}/leads/export.csv`, ({ request }) => {
    const g = guard(request, { owner: true })
    if ('res' in g) return g.res
    const rows = [['number', 'name', 'contact_type', 'contact_value', 'service', 'status', 'created_at'], ...db.leads.map((l) => [l.number, l.name, l.contact_type, l.contact_value, l.service, l.status, l.created_at])]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    return new HttpResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } })
  }),
  http.get(`${B}/leads`, ({ request }) => {
    const g = guard(request)
    if ('res' in g) return g.res
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    let items = db.leads.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))
    if (status) items = items.filter((l) => l.status === status)
    if (q) items = items.filter((l) => [l.name, l.contact_value, l.message, String(l.number)].some((v) => v.toLowerCase().includes(q)))
    if (from) items = items.filter((l) => l.created_at.slice(0, 10) >= from)
    if (to) items = items.filter((l) => l.created_at.slice(0, 10) <= to)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return HttpResponse.json(paginate(items.map(({ events, ...l }) => l), url))
  }),
  http.get(`${B}/leads/:id`, ({ request, params }) => {
    const g = guard(request)
    if ('res' in g) return g.res
    const l = db.leads.find((x) => x.id === params.id)
    return l ? HttpResponse.json(l) : problem(404, 'not_found', 'Topilmadi')
  }),
  http.patch(`${B}/leads/:id`, async ({ request, params }) => {
    const g = guard(request, { owner: true })
    if ('res' in g) return g.res
    const l = db.leads.find((x) => x.id === params.id)
    if (!l) return problem(404, 'not_found', 'Topilmadi')
    const body = (await request.json()) as { status?: LeadStatus; assigned_to?: string | null }
    if (body.status && body.status !== l.status) {
      l.events = [...(l.events ?? []), { id: seed.uid(), kind: 'status_change', actor: { id: g.user.id, email: g.user.email }, payload: { from: l.status, to: body.status }, created_at: now() }]
      l.status = body.status
    }
    if ('assigned_to' in body) l.assigned_to = body.assigned_to ?? null
    l.updated_at = now()
    return HttpResponse.json(l)
  }),
  http.post(`${B}/leads/:id/events`, async ({ request, params }) => {
    const g = guard(request)
    if ('res' in g) return g.res
    const l = db.leads.find((x) => x.id === params.id)
    if (!l) return problem(404, 'not_found', 'Topilmadi')
    const body = (await request.json()) as { kind: 'note' | 'call'; payload: { text: string } }
    if (!['note', 'call'].includes(body.kind) || !body.payload?.text?.trim()) return problem(422, 'validation_error', "Ma'lumot noto'g'ri", [{ field: 'payload.text', msg: "Matn bo'sh" }])
    const ev = { id: seed.uid(), kind: body.kind, actor: { id: g.user.id, email: g.user.email }, payload: { text: body.payload.text }, created_at: now() }
    l.events = [...(l.events ?? []), ev]
    return HttpResponse.json(ev, { status: 201 })
  }),
]

// ---------- tizim ----------
const systemHandlers = [
  http.get(`${B}/dashboard`, ({ request }) => {
    const g = guard(request)
    if ('res' in g) return g.res
    const day = 86_400_000
    const age = (l: Lead) => Date.now() - Date.parse(l.created_at)
    return HttpResponse.json({
      leads: { today: db.leads.filter((l) => age(l) < day).length, week: db.leads.filter((l) => age(l) < 7 * day).length, month: db.leads.filter((l) => age(l) < 30 * day).length },
      new_leads: db.leads.filter((l) => l.status === 'new'),
      recent_publications: (['projects', 'services', 'posts'] as const)
        .flatMap((res) => (db[res] as Row[]).filter((r) => r.status === 'published').map((r) => ({ entity: res, id: r.id, title: String(r.title), published_at: String(r.published_at) })))
        .sort((a, b) => b.published_at.localeCompare(a.published_at))
        .slice(0, 5),
      system: { last_backup_at: new Date(Date.now() - 5 * 3600_000).toISOString(), errors_24h: 0, worker_ok: true },
    })
  }),
  http.get(`${B}/settings`, ({ request }) => {
    const g = guard(request, { owner: true })
    if ('res' in g) return g.res
    return HttpResponse.json(db.settings)
  }),
  http.put(`${B}/settings`, async ({ request }) => {
    const g = guard(request, { owner: true })
    if ('res' in g) return g.res
    const before = db.settings
    db.settings = (await request.json()) as typeof db.settings
    audit(g.user, 'update', 'settings', null, { before, after: db.settings })
    return HttpResponse.json(db.settings)
  }),
  http.get(`${B}/users`, ({ request }) => {
    const g = guard(request, { owner: true })
    if ('res' in g) return g.res
    return HttpResponse.json({ items: db.users.map(publicUser), total: db.users.length, page: 1, limit: 50 })
  }),
  http.post(`${B}/users`, async ({ request }) => {
    const g = guard(request, { owner: true })
    if ('res' in g) return g.res
    const body = (await request.json()) as { email: string; name: string; role: 'owner' | 'editor'; password: string }
    if (db.users.some((u) => u.email === body.email.toLowerCase())) return problem(422, 'validation_error', "Ma'lumot noto'g'ri", [{ field: 'email', msg: 'Bu email band' }])
    if (!body.password || body.password.length < 12) return problem(422, 'validation_error', "Ma'lumot noto'g'ri", [{ field: 'password', msg: 'Parol kamida 12 belgi' }])
    const u: seed.MockUser = { id: seed.uid(), email: body.email.toLowerCase(), name: body.name, role: body.role, is_active: true, last_login_at: null, totp_enabled: false, password: body.password }
    db.users.push(u)
    audit(g.user, 'create', 'users', u.id, { after: { email: u.email, role: u.role } })
    return HttpResponse.json(publicUser(u), { status: 201 })
  }),
  http.patch(`${B}/users/:id`, async ({ request, params }) => {
    const g = guard(request, { owner: true })
    if ('res' in g) return g.res
    const u = db.users.find((x) => x.id === params.id)
    if (!u) return problem(404, 'not_found', 'Topilmadi')
    const body = (await request.json()) as { role?: 'owner' | 'editor'; is_active?: boolean; revoke_sessions?: boolean }
    if (body.role) u.role = body.role
    if (typeof body.is_active === 'boolean') u.is_active = body.is_active
    audit(g.user, 'update', 'users', u.id, body)
    return HttpResponse.json(publicUser(u))
  }),
  http.get(`${B}/audit-logs`, ({ request }) => {
    const g = guard(request, { owner: true })
    if ('res' in g) return g.res
    const url = new URL(request.url)
    const entity = url.searchParams.get('entity')
    const actor = url.searchParams.get('actor_id')
    let items = db.audit
    if (entity) items = items.filter((a) => a.entity === entity)
    if (actor) items = items.filter((a) => a.actor?.id === actor)
    return HttpResponse.json(paginate(items, url))
  }),
  http.get(`${B}/redirects`, ({ request }) => {
    const g = guard(request, { owner: true })
    if ('res' in g) return g.res
    return HttpResponse.json({ items: db.redirects, total: db.redirects.length, page: 1, limit: 50 })
  }),
  http.post(`${B}/redirects`, async ({ request }) => {
    const g = guard(request, { owner: true })
    if ('res' in g) return g.res
    const body = (await request.json()) as { from_path: string; to_path: string; code: 301 | 302 }
    if (db.redirects.some((r) => r.from_path === body.from_path)) return problem(422, 'validation_error', "Ma'lumot noto'g'ri", [{ field: 'from_path', msg: 'Bu yo‘l uchun redirect bor' }])
    const r = { id: seed.uid(), ...body }
    db.redirects.push(r)
    return HttpResponse.json(r, { status: 201 })
  }),
  http.delete(`${B}/redirects/:id`, ({ request, params }) => {
    const g = guard(request, { owner: true })
    if ('res' in g) return g.res
    db.redirects = db.redirects.filter((r) => r.id !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),
  http.post(`${B}/site/rebuild`, ({ request }) => {
    const g = guard(request, { owner: true })
    if ('res' in g) return g.res
    return HttpResponse.json({ job_id: 'job-' + Math.random().toString(36).slice(2, 8) }, { status: 202 })
  }),
]

export const handlers = [...authHandlers, ...mediaHandlers, ...leadHandlers, ...systemHandlers, ...CONTENT.flatMap(contentHandlers)]
