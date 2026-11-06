import { screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { preloadPages, renderApp } from '@/test/utils'
import { MOCK_BACKUP_CODE, MOCK_PASSWORD, MOCK_TOTP } from '@/mocks/seed'

async function fillCredentials(user: ReturnType<typeof renderApp>['user'], email: string, password = MOCK_PASSWORD) {
  await user.type(await screen.findByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Parol'), password)
  await user.click(screen.getByRole('button', { name: 'Kirish' }))
}

describe('Login', () => {
  it("sessiyasiz foydalanuvchi /login ga yo'naltiriladi", async () => {
    renderApp('/loyihalar', { as: null })
    expect(await screen.findByRole('button', { name: 'Kirish' })).toBeInTheDocument()
  })

  it("noto'g'ri parol: bir xil umumiy xabar", async () => {
    const { user } = renderApp('/login', { as: null })
    await fillCredentials(user, 'owner@jamolxon.uz', 'notogri-parol-123')
    expect(await screen.findByRole('alert')).toHaveTextContent("Email yoki parol noto'g'ri")
  })

  it("mavjud bo'lmagan email ham xuddi shu xabarni beradi", async () => {
    const { user } = renderApp('/login', { as: null })
    await fillCredentials(user, 'hech-kim@jamolxon.uz')
    expect(await screen.findByRole('alert')).toHaveTextContent("Email yoki parol noto'g'ri")
  })

  it('423 — blok xabari', async () => {
    const { user } = renderApp('/login', { as: null })
    await fillCredentials(user, 'locked@jamolxon.uz')
    expect(await screen.findByRole('alert')).toHaveTextContent(/bloklangan/)
  })

  it("429 — Retry-After bo'yicha kutish vaqti", async () => {
    const { user } = renderApp('/login', { as: null })
    await fillCredentials(user, 'ratelimit@jamolxon.uz')
    expect(await screen.findByRole('alert')).toHaveTextContent('120 soniyadan keyin')
  })

  it('login → 2FA sozlash (QR + secret) → kod → 10 ta zaxira kod → dashboard', async () => {
    const { user, router } = renderApp('/login', { as: null })
    await fillCredentials(user, 'yangi@jamolxon.uz')

    expect(await screen.findByText('2FA ni yoqing')).toBeInTheDocument()
    expect(screen.getByTestId('totp-qr').querySelector('svg')).not.toBeNull()
    expect(screen.getByTestId('totp-secret')).toHaveTextContent('JBSWY3DPEHPK3PXP')

    // noto'g'ri kod
    await user.type(screen.getByLabelText('Ilovadagi 6 xonali kod'), '000000')
    await user.click(screen.getByRole('button', { name: /Tasdiqlash va yoqish/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Kod noto'g'ri")

    await user.clear(screen.getByLabelText('Ilovadagi 6 xonali kod'))
    await user.type(screen.getByLabelText('Ilovadagi 6 xonali kod'), MOCK_TOTP)
    await user.click(screen.getByRole('button', { name: /Tasdiqlash va yoqish/ }))

    const list = await screen.findByRole('list', { name: 'Zaxira kodlar' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(10)
    expect(screen.getByRole('button', { name: /Nusxa olish/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Yuklab olish/ })).toBeInTheDocument()

    const cont = screen.getByRole('button', { name: 'Davom etish' })
    expect(cont).toBeDisabled()
    await user.click(screen.getByLabelText('Kodlarni saqladim'))
    await user.click(cont)
    expect(await screen.findByText('Bugungi holat')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('2FA kerak: zaxira kod bilan kirish mumkin', async () => {
    const { user } = renderApp('/login', { as: null })
    await fillCredentials(user, 'owner@jamolxon.uz')
    expect(await screen.findByText('Ikki bosqichli tekshiruv')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Zaxira kod bilan kirish/ }))
    await user.type(screen.getByLabelText('Zaxira kod'), MOCK_BACKUP_CODE)
    await user.click(screen.getByRole('button', { name: 'Tasdiqlash' }))
    expect(await screen.findByText('Bugungi holat')).toBeInTheDocument()
  })
})

beforeAll(preloadPages, 300_000)
