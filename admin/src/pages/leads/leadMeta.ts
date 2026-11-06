import type { ContactType, Lead, LeadStatus } from '@/lib/types'

export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'proposal_sent', 'won', 'lost', 'spam']

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'Yangi',
  contacted: 'Aloqada',
  proposal_sent: 'Taklif yuborildi',
  won: 'Kelishildi',
  lost: 'Rad etildi',
  spam: 'Spam',
}

export const LEAD_STATUS_COLOR: Record<LeadStatus, string> = {
  new: 'bg-yellow',
  contacted: 'bg-sky-400',
  proposal_sent: 'bg-orange-400',
  won: 'bg-emerald-400',
  lost: 'bg-zinc-400',
  spam: 'bg-red',
}

export const CONTACT_LABEL: Record<ContactType, string> = { email: 'Email', telegram: 'Telegram', phone: 'Telefon' }

export const BUDGET_LABEL: Record<string, string> = {
  '<500': '$500 gacha',
  '500-1000': '$500–1000',
  '1000-3000': '$1000–3000',
  '3000-10000': '$3000–10000',
  '10000+': '$10000+',
  aniq_emas: 'Aniq emas',
}

export const DEADLINE_LABEL: Record<string, string> = {
  shoshilinch: 'Shoshilinch',
  '1_oy': '1 oy',
  '3_oy': '3 oy',
  aniq_emas: 'Aniq emas',
}

export function telegramUrl(lead: Pick<Lead, 'contact_type' | 'contact_value'>): string | null {
  if (lead.contact_type !== 'telegram') return null
  const handle = lead.contact_value.trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '')
  return /^[A-Za-z0-9_]{5,32}$/.test(handle) ? `https://t.me/${handle}` : null
}

export function phoneUrl(lead: Pick<Lead, 'contact_type' | 'contact_value'>): string | null {
  if (lead.contact_type !== 'phone') return null
  const digits = lead.contact_value.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : null
}

export function mailUrl(lead: Pick<Lead, 'contact_type' | 'contact_value'>): string | null {
  return lead.contact_type === 'email' ? `mailto:${lead.contact_value.trim()}` : null
}
