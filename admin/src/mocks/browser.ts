import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

/**
 * `npm run dev:mock`: brauzerda soxta API.
 * Kirish: owner@jamolxon.uz / editor@jamolxon.uz / yangi@jamolxon.uz (2FA sozlash), parol `parol-namuna-123`,
 * 2FA kodi `123456`, zaxira kod `abcd-1234`.
 */
export const worker = setupWorker(...handlers)
