import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp } from '@/test/utils'
import { server } from '@/mocks/node'
import { db } from '@/mocks/handlers'

describe('Leadlar', () => {
  it("kanban: statusni ko'chirish PATCH /leads/{id} {status} ni chaqiradi", async () => {
    const patches: { url: string; body: unknown }[] = []
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'PATCH') patches.push({ url: request.url, body: await request.clone().json() })
    })
    const { user } = renderApp('/leadlar')
    const newCol = await screen.findByTestId('column-new')
    expect(await within(newCol).findByText('Aziz Karimov')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('#121 statusi'), 'contacted')

    // Optimistik: karta darhol "Aloqada" ustuniga o'tadi
    const contacted = screen.getByTestId('column-contacted')
    expect(await within(contacted).findByText('Aziz Karimov')).toBeInTheDocument()
    await waitFor(() => expect(patches).toHaveLength(1))
    expect(patches[0].url).toMatch(/\/api\/v1\/admin\/leads\/l-1$/)
    expect(patches[0].body).toEqual({ status: 'contacted' })
    await waitFor(() => expect(db.leads.find((l) => l.id === 'l-1')?.status).toBe('contacted'))
    server.events.removeAllListeners()
  })

  it("editor status o'zgartira olmaydi va CSV eksportni ko'rmaydi, lekin izoh qo'sha oladi", async () => {
    const { user } = renderApp('/leadlar', { as: 'u-editor' })
    await within(await screen.findByTestId('column-new')).findByText('Aziz Karimov')
    expect(screen.queryByLabelText('#121 statusi')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /CSV eksport/ })).not.toBeInTheDocument()

    await user.click(screen.getByText('Aziz Karimov'))
    expect(await screen.findByRole('link', { name: /Telegram'da yozish/ })).toHaveAttribute('href', 'https://t.me/aziz_k')
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Izoh matni'), 'Ertaga qo‘ng‘iroq qilaman')
    await user.click(screen.getByRole('button', { name: 'Qo‘shish' }))
    expect(await screen.findByText('Ertaga qo‘ng‘iroq qilaman')).toBeInTheDocument()
    expect(db.leads.find((l) => l.id === 'l-1')?.events?.[0]).toMatchObject({ kind: 'note', payload: { text: 'Ertaga qo‘ng‘iroq qilaman' } })
  })

  it("telefon lead uchun tel: havola, jadval ko'rinishi", async () => {
    const { user } = renderApp('/leadlar?view=jadval&lead=l-2')
    expect(await screen.findByRole('link', { name: /Qo‘ng‘iroq/ })).toHaveAttribute('href', 'tel:+998901234567')
    await user.keyboard('{Escape}')
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getAllByRole('row').length).toBeGreaterThan(5)
  })

  it("owner CSV eksport tugmasini ko'radi", async () => {
    renderApp('/leadlar')
    expect(await screen.findByRole('button', { name: /CSV eksport/ })).toBeInTheDocument()
  })
})
