import { screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { preloadPages, renderApp } from '@/test/utils'

describe('Rollar', () => {
  it("editor menyuda Sozlamalar/Foydalanuvchilar/Audit'ni ko'rmaydi", async () => {
    renderApp('/', { as: 'u-editor' })
    const nav = (await screen.findAllByRole('navigation', { name: 'Asosiy menyu' }))[0]
    expect(nav).toHaveTextContent('Loyihalar')
    expect(nav).toHaveTextContent('Leadlar')
    expect(nav).not.toHaveTextContent('Sozlamalar')
    expect(nav).not.toHaveTextContent('Foydalanuvchilar')
    expect(nav).not.toHaveTextContent('Audit')
  })

  it("owner hamma bo'limlarni ko'radi", async () => {
    renderApp('/', { as: 'u-owner' })
    const nav = (await screen.findAllByRole('navigation', { name: 'Asosiy menyu' }))[0]
    expect(nav).toHaveTextContent('Sozlamalar')
    expect(nav).toHaveTextContent('Foydalanuvchilar')
    expect(nav).toHaveTextContent('Audit')
  })

  it("editor /sozlamalar ga kirsa bosh sahifaga qaytariladi", async () => {
    const { router } = renderApp('/sozlamalar', { as: 'u-editor' })
    expect(await screen.findByText('Bugungi holat')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByRole('heading', { name: 'Sozlamalar' })).not.toBeInTheDocument()
  })

  it.each(['/foydalanuvchilar', '/audit'])("editor %s dan ham qaytariladi", async (path) => {
    const { router } = renderApp(path, { as: 'u-editor' })
    expect(await screen.findByText('Bugungi holat')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('owner /sozlamalar ni ochadi', async () => {
    renderApp('/sozlamalar', { as: 'u-owner' })
    expect(await screen.findByRole('heading', { name: 'Sozlamalar' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Chat ID (bildirishnomalar)')).toHaveValue('123456789')
  })
})

beforeAll(preloadPages, 300_000)
