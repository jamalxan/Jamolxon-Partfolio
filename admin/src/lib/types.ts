// docs/API.md bo'yicha tiplar. Backend shu kontraktga mos ishlaydi.

export type Role = 'owner' | 'editor'
export type ContentStatus = 'draft' | 'published' | 'archived'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  is_active: boolean
  last_login_at: string | null
  totp_enabled: boolean
}

export interface ListResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export interface ProblemFieldError {
  field: string
  msg: string
}

export interface Problem {
  type: string
  title: string
  status: number
  errors?: ProblemFieldError[]
  request_id?: string
  detail?: string
}

export interface Timestamps {
  created_at: string
  updated_at: string
}

export interface Publishable extends Timestamps {
  status: ContentStatus
  published_at: string | null
  sort_order: number
}

export interface Section {
  h: string
  p: string[]
}

export interface ProjectLink {
  label: string
  url: string
}

export interface GalleryItem {
  media_id: string
  caption: string
}

export type ProjectCategory = 'prod' | 'pm' | 'own' | 'sale'

export interface Project extends Publishable {
  id: string
  slug: string
  title: string
  subtitle: string
  category: ProjectCategory
  url: string
  year: string
  role: string
  stack: string[]
  summary: string
  sections: Section[]
  results: string[]
  links: ProjectLink[]
  illo: string
  image: string | null
  cover_id: string | null
  gallery: GalleryItem[]
  seo_title: string
  seo_description: string
  is_featured: boolean
}

export interface Service extends Publishable {
  id: string
  slug: string
  title: string
  icon: string
  illo: string
  short: string
  who: string[]
  includes: string[]
  process: string[]
  examples: string[]
  stack: string[]
  timeline: string
  faq: [string, string][]
  price_from: string | null
  duration: string | null
  seo_title: string
  seo_description: string
}

export interface Post extends Publishable {
  id: string
  slug: string
  title: string
  excerpt: string
  body_md: string
  body_html: string
  tags: string[]
  cover_id: string | null
  reading_min: number
  seo_title: string
  seo_description: string
}

export interface Category {
  id: string
  slug: string
  title: string
  short: string
  badge: string
  dot: string
  description: string
  color: string
  sort_order: number
  updated_at?: string
}

export interface Tag {
  id: string
  slug: string
  title: string
  sort_order?: number
  updated_at?: string
}

export interface Offer {
  id: string
  key: string
  title: string
  icon: string
  problem: string
  solution: string
  examples: [string, string][]
  sort_order: number
  updated_at?: string
}

export interface Step {
  id: string
  title: string
  text: string
  get: string
  sort_order: number
  updated_at?: string
}

export interface MediaUsage {
  entity: string
  id: string
  title: string
}

export interface Media {
  id: string
  url: string
  original_name: string
  mime: string
  size_bytes: number
  width: number | null
  height: number | null
  variants: Record<string, Record<string, string>>
  alt: string
  blurhash: string | null
  used_in: MediaUsage[]
  created_at: string
}

export type LeadStatus = 'new' | 'contacted' | 'proposal_sent' | 'won' | 'lost' | 'spam'
export type ContactType = 'email' | 'telegram' | 'phone'

export interface LeadEvent {
  id: string
  kind: 'status_change' | 'note' | 'call' | string
  actor: { id: string; email: string } | null
  payload: Record<string, unknown>
  created_at: string
}

export interface Lead {
  id: string
  number: number
  name: string
  contact_type: ContactType
  contact_value: string
  service: string
  budget_range: string | null
  deadline: string | null
  message: string
  status: LeadStatus
  source_page: string | null
  utm: Record<string, string> | null
  spam_score: number
  assigned_to: string | null
  created_at: string
  updated_at: string
  events?: LeadEvent[]
}

export interface Dashboard {
  leads: { today: number; week: number; month: number }
  new_leads: Lead[]
  recent_publications: { entity: string; id: string; title: string; published_at: string }[]
  system: { last_backup_at: string | null; errors_24h: number; worker_ok: boolean }
}

export interface Settings {
  contact: Record<string, unknown>
  social: Record<string, string>
  seo: { title: string; description: string; og_image: string | null }
  telegram: { chat_id: string }
}

export interface AuditLog {
  id: string
  actor: { id: string; email: string } | null
  action: string
  entity: string
  entity_id: string | null
  diff: unknown
  ip: string | null
  created_at: string
}

export interface Redirect {
  id: string
  from_path: string
  to_path: string
  code: 301 | 302
}

export type LoginResult = { status: '2fa_required' } | { status: '2fa_setup_required' }
export interface TwoFaSetup {
  secret: string
  otpauth_url: string
}
export interface VerifyResult {
  user: User
  backup_codes: string[] | null
}
