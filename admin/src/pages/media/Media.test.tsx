import { screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { preloadPages, renderApp } from '@/test/utils'
import { db } from '@/mocks/handlers'

const png = () => new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'rasm.png', { type: 'image/png' })

describe('Media', () => {
  it("alt matnsiz yuklab bo'lmaydi; alt bilan yuklanadi", async () => {
    const { user } = renderApp('/media')
    await screen.findByText('socialauto.png')
    const before = db.media.length

    await user.upload(screen.getByTestId('file-input'), png())
    expect(await screen.findByText('rasm.png')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Yuklash/ }))
    expect(await screen.findByText('Alt matn majburiy')).toBeInTheDocument()
    expect(db.media.length).toBe(before)

    await user.type(screen.getByLabelText('Alt matn (majburiy)'), 'Loyiha skrinshoti')
    await user.click(screen.getByRole('button', { name: /Yuklash/ }))
    await waitFor(() => expect(db.media.length).toBe(before + 1))
    expect(db.media[0].alt).toBe('Loyiha skrinshoti')
  })

  it("SVG va 10 MB dan katta fayl rad etiladi", async () => {
    const { user } = renderApp('/media')
    await screen.findByText('socialauto.png')
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'katta.png', { type: 'image/png' })
    await user.upload(screen.getByTestId('file-input'), big)
    await user.type(screen.getByLabelText('Alt matn (majburiy)'), 'x')
    await user.click(screen.getByRole('button', { name: /Yuklash/ }))
    expect(await screen.findByText('Fayl 10 MB dan oshmasin')).toBeInTheDocument()
  })

  it("ishlatilayotgan faylni o'chirish tugmasi o'chiq", async () => {
    renderApp('/media')
    expect(await screen.findByRole('button', { name: "socialauto.pngni o'chirish" })).toBeDisabled()
    expect(screen.getByRole('button', { name: "vocably.pngni o'chirish" })).toBeEnabled()
    expect(screen.getByText('Loyiha: SocialAuto')).toBeInTheDocument()
  })
})

beforeAll(preloadPages, 300_000)
