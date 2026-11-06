import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeAll, describe, expect, it } from 'vitest'
import { preloadPages, renderApp } from '@/test/utils'
import { server } from '@/mocks/node'
import { B, db } from '@/mocks/handlers'
import { draftKey } from '@/hooks/useAutosave'
import { projectToForm } from './ProjectEditPage'
import type { Project } from '@/lib/types'

async function fill(user: ReturnType<typeof renderApp>['user'], el: HTMLElement, text: string) {
  await user.click(el)
  await user.paste(text)
}

const p1 = () => db.projects.find((p) => p.id === 'p-1') as unknown as Project

describe('Loyiha formasi', () => {
  it("klient validatsiyasi: noto'g'ri slug va bo'sh sarlavha, so'rov yuborilmaydi", async () => {
    let posted = false
    server.use(
      http.post(`${B}/projects`, () => {
        posted = true
        return HttpResponse.json({}, { status: 500 })
      }),
    )
    const { user } = renderApp('/loyihalar/yangi')
    const slug = await screen.findByLabelText('Slug (URL)')
    await fill(user, slug, 'Yomon Slug!')
    await user.click(screen.getByRole('button', { name: /Saqlash/ }))
    expect(await screen.findByText(/Slug faqat kichik lotin harflari/)).toBeInTheDocument()
    expect(screen.getByText(/Sarlavha majburiy/)).toBeInTheDocument()
    expect(slug).toHaveAttribute('aria-invalid', 'true')
    expect(posted).toBe(false)
  })

  it("server 422 errors[].field ni forma maydonlariga bog'laydi", async () => {
    server.use(
      http.post(`${B}/projects`, () =>
        HttpResponse.json(
          {
            type: 'validation_error',
            title: "Ma'lumot noto'g'ri",
            status: 422,
            errors: [
              { field: 'body.slug', msg: 'Bu slug band' },
              { field: 'title', msg: 'Bunday sarlavha bor' },
            ],
          },
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    const { user } = renderApp('/loyihalar/yangi')
    await fill(user, await screen.findByLabelText('Sarlavha'), 'Yangi loyiha')
    await fill(user, screen.getByLabelText('Slug (URL)'), 'socialauto')
    await user.click(screen.getByRole('button', { name: /Saqlash/ }))
    expect(await screen.findByText('Bu slug band')).toBeInTheDocument()
    expect(screen.getByText('Bunday sarlavha bor')).toBeInTheDocument()
    expect(screen.getByLabelText('Slug (URL)')).toHaveAttribute('aria-invalid', 'true')
  })

  it('mock backend ham band slugni 422 bilan qaytaradi', async () => {
    const { user } = renderApp('/loyihalar/yangi')
    await fill(user, await screen.findByLabelText('Sarlavha'), 'Takror')
    await fill(user, screen.getByLabelText('Slug (URL)'), 'vocably')
    await user.click(screen.getByRole('button', { name: /Saqlash/ }))
    expect(await screen.findByText('Bu slug band')).toBeInTheDocument()
  })

  it("yangi loyiha yaratiladi va tahrirlash sahifasiga o'tadi", async () => {
    const { user, router } = renderApp('/loyihalar/yangi')
    await fill(user, await screen.findByLabelText('Sarlavha'), 'CRM tizim')
    await fill(user, screen.getByLabelText('Slug (URL)'), 'crm-tizim')
    await user.click(screen.getByRole('button', { name: /Saqlash/ }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/loyihalar\/[0-9a-f-]{36}$/))
    const created = db.projects.find((p) => p.slug === 'crm-tizim')
    expect(created?.status).toBe('draft')
  })

  it("409: \"Bu yozuv o'zgargan, yangilang\" va Yangilash tugmasi", async () => {
    const { user } = renderApp('/loyihalar/p-1')
    const title = await screen.findByDisplayValue('SocialAuto')
    // Boshqa oynada kimdir saqladi
    Object.assign(p1(), { title: 'SocialAuto 2.0', updated_at: '2026-11-06T12:00:00.000Z' })
    await user.clear(title)
    await fill(user, title, 'Mening tahririm')
    await user.click(screen.getByRole('button', { name: /Saqlash/ }))
    expect(await screen.findByText("Bu yozuv o'zgargan, yangilang")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Yangilash/ }))
    expect(await screen.findByDisplayValue('SocialAuto 2.0')).toBeInTheDocument()
    expect(screen.queryByText("Bu yozuv o'zgargan, yangilang")).not.toBeInTheDocument()
  })

  it('Ctrl+S saqlaydi (PATCH updated_at bilan)', async () => {
    let body: Record<string, unknown> | null = null
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'PATCH' && request.url.endsWith('/projects/p-1')) body = (await request.clone().json()) as Record<string, unknown>
    })
    const { user } = renderApp('/loyihalar/p-1')
    const title = await screen.findByDisplayValue('SocialAuto')
    await user.clear(title)
    await fill(user, title, 'SocialAuto Pro')
    await user.keyboard('{Control>}s{/Control}')
    await waitFor(() => expect(p1().title).toBe('SocialAuto Pro'))
    expect(body).toMatchObject({ title: 'SocialAuto Pro', updated_at: '2026-11-01T10:00:00.000Z' })
    expect(body).not.toHaveProperty('id')
    expect(body).not.toHaveProperty('status')
    server.events.removeAllListeners()
  })

  it('nashr tugmasi /publish ni chaqiradi', async () => {
    const { user } = renderApp('/loyihalar/p-2')
    await screen.findByDisplayValue('Vocably')
    await user.click(screen.getByRole('button', { name: /Nashr/ }))
    await waitFor(() => expect((db.projects.find((p) => p.id === 'p-2') as unknown as Project).status).toBe('published'))
  })
})

describe('Avtosaqlash', () => {
  it("localStorage'dagi qoralamani qayta ochilganda tiklashni taklif qiladi", async () => {
    const values = { ...projectToForm(p1()), title: 'Qoralamadagi sarlavha' }
    localStorage.setItem(draftKey('projects', 'p-1'), JSON.stringify({ values, saved_at: new Date().toISOString(), base_updated_at: p1().updated_at }))
    const { user } = renderApp('/loyihalar/p-1')
    expect(await screen.findByText(/Saqlanmagan qoralama topildi/)).toBeInTheDocument()
    expect(await screen.findByDisplayValue('SocialAuto')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tiklash' }))
    expect(screen.getByLabelText('Sarlavha')).toHaveValue('Qoralamadagi sarlavha')
    expect(screen.getByText(/saqlanmagan o‘zgarishlar/)).toBeInTheDocument()
  })

  it("qoralamani o'chirish", async () => {
    localStorage.setItem(draftKey('projects', 'p-1'), JSON.stringify({ values: projectToForm(p1()), saved_at: new Date().toISOString(), base_updated_at: null }))
    const { user } = renderApp('/loyihalar/p-1')
    await user.click(await screen.findByRole('button', { name: 'O‘chirish' }))
    expect(localStorage.getItem(draftKey('projects', 'p-1'))).toBeNull()
  })
})

beforeAll(preloadPages, 300_000)
