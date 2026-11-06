import { z } from 'zod'

// Backend (Pydantic) bilan bir xil qoidalar: docs/API.md, TZ 7 va 9 (SEO uzunliklari).

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const slug = z
  .string()
  .trim()
  .min(1, 'Slug majburiy')
  .max(120, 'Slug 120 belgidan oshmasin')
  .regex(SLUG_RE, "Slug faqat kichik lotin harflari, raqam va '-' dan iborat bo'lsin (masalan: crm-tizim)")

export const title = z
  .string()
  .trim()
  .min(2, 'Sarlavha majburiy (kamida 2 belgi)')
  .max(120, 'Sarlavha 120 belgidan oshmasin')

export const seoTitle = z.string().trim().max(60, 'SEO sarlavha 60 belgidan oshmasin')
export const seoDescription = z.string().trim().max(155, 'SEO tavsif 155 belgidan oshmasin')

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), "To'g'ri havola kiriting (https://...)")

const requiredUrl = z.string().trim().min(1, 'Havola majburiy').regex(/^https?:\/\/[^\s]+$/i, "To'g'ri havola kiriting (https://...)")

const nonEmpty = (label: string, max = 2000) =>
  z.string().trim().min(1, `${label} bo'sh bo'lmasin`).max(max, `${label} ${max} belgidan oshmasin`)

const stringList = (label: string, max = 1000) => z.array(nonEmpty(label, max)).max(50, "Ro'yxat juda uzun (50 tagacha)")

export const PROJECT_CATEGORIES = ['prod', 'pm', 'own', 'sale'] as const
export const ILLOS = ['dashboard', 'ai', 'bot', 'brand', 'cards', 'chat', 'exam', 'office', 'portfolio', 'shop', 'site'] as const
export const ICONS = ['site', 'ai', 'bot', 'chat', 'content', 'design', 'edu', 'erp', 'ig', 'link'] as const

export const projectSchema = z.object({
  slug,
  title,
  subtitle: z.string().trim().max(200, 'Qisqa tavsif 200 belgidan oshmasin'),
  category: z.enum(PROJECT_CATEGORIES, { error: 'Kategoriyani tanlang' }),
  url: optionalUrl,
  year: z.string().trim().refine((v) => v === '' || /^(19|20)\d{2}$/.test(v), "Yil 4 xonali bo'lsin (masalan: 2025)"),
  role: z.string().trim().max(200),
  stack: z.array(z.string().trim().min(1).max(40, 'Teg 40 belgidan oshmasin')).max(30),
  summary: z.string().trim().max(1000, 'Qisqacha mazmun 1000 belgidan oshmasin'),
  sections: z
    .array(
      z.object({
        h: nonEmpty('Bo‘lim sarlavhasi', 120),
        p: z.array(nonEmpty('Paragraf', 4000)).min(1, 'Kamida bitta paragraf'),
      }),
    )
    .max(20),
  results: stringList('Natija', 300),
  links: z.array(z.object({ label: nonEmpty('Havola nomi', 80), url: requiredUrl })).max(20),
  illo: z.string().trim().max(40),
  image: optionalUrl,
  cover_id: z.string().nullable(),
  gallery: z.array(z.object({ media_id: z.string().min(1), caption: z.string().trim().max(200) })).max(40),
  seo_title: seoTitle,
  seo_description: seoDescription,
  is_featured: z.boolean(),
})
export type ProjectForm = z.infer<typeof projectSchema>

export const serviceSchema = z.object({
  slug,
  title,
  icon: z.string().trim().max(40),
  illo: z.string().trim().max(40),
  short: z.string().trim().min(1, "Qisqa tavsif majburiy").max(400, 'Qisqa tavsif 400 belgidan oshmasin'),
  who: stringList('Band', 300),
  includes: stringList('Band', 300),
  process: stringList('Qadam', 300),
  examples: z.array(slug),
  stack: z.array(z.string().trim().min(1).max(40)).max(30),
  timeline: z.string().trim().max(300),
  faq: z.array(z.object({ q: nonEmpty('Savol', 300), a: nonEmpty('Javob', 2000) })).max(30),
  price_from: z.string().trim().max(60),
  duration: z.string().trim().max(60),
  seo_title: seoTitle,
  seo_description: seoDescription,
})
export type ServiceForm = z.infer<typeof serviceSchema>

export const postSchema = z.object({
  slug,
  title,
  excerpt: z.string().trim().max(400, 'Qisqa mazmun 400 belgidan oshmasin'),
  body_md: z.string().max(100_000, 'Matn juda uzun'),
  tags: z.array(z.string().trim().min(1).max(40)).max(10, 'Ko‘pi bilan 10 ta teg'),
  cover_id: z.string().nullable(),
  seo_title: seoTitle,
  seo_description: seoDescription,
})
export type PostForm = z.infer<typeof postSchema>

export const categorySchema = z.object({
  slug,
  title,
  short: z.string().trim().max(60),
  badge: z.string().trim().max(40),
  dot: z.string().trim().max(40),
  description: z.string().trim().max(500),
  color: z.string().trim().refine((v) => v === '' || /^#[0-9a-fA-F]{6}$/.test(v), 'Rang #RRGGBB ko‘rinishida'),
})

export const tagSchema = z.object({ slug, title })

export const offerSchema = z.object({
  key: slug,
  title,
  icon: z.string().trim().max(40),
  problem: nonEmpty('Muammo', 1000),
  solution: nonEmpty('Yechim', 1000),
  examples: z.array(z.object({ label: nonEmpty('Nomi', 80), slug })).max(10),
})

export const stepSchema = z.object({
  title,
  text: nonEmpty('Matn', 1000),
  get: z.string().trim().max(500),
})

export const MEDIA_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf'] as const
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024

export const mediaUploadSchema = z.object({
  file: z
    // instanceof o'rniga duck-typing: turli muhitlardagi (brauzer/Node) File klasslari bilan ishlaydi
    .custom<File>((v) => !!v && typeof v === 'object' && 'name' in v && 'size' in v && 'type' in v, { message: 'Fayl tanlang' })
    .refine((f) => f.size <= MEDIA_MAX_BYTES, 'Fayl 10 MB dan oshmasin')
    .refine((f) => (MEDIA_MIME as readonly string[]).includes(f.type), 'Faqat JPEG, PNG, WebP, AVIF yoki PDF'),
  alt: z.string().trim().min(1, 'Alt matn majburiy').max(300, 'Alt matn 300 belgidan oshmasin'),
})

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email kiriting').email("Email noto'g'ri"),
  password: z.string().min(1, 'Parol kiriting'),
})

export const totpSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, '6 xonali kod kiriting') })
export const backupCodeSchema = z.object({
  backup_code: z.string().trim().regex(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/, 'Zaxira kod xxxx-xxxx ko‘rinishida'),
})

export const passwordSchema = z
  .string()
  .min(12, 'Parol kamida 12 belgi')
  .max(128, 'Parol 128 belgidan oshmasin')

export const userCreateSchema = z.object({
  email: z.string().trim().email("Email noto'g'ri"),
  name: z.string().trim().min(2, 'Ism kamida 2 belgi').max(80),
  role: z.enum(['owner', 'editor']),
  password: passwordSchema,
})

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Joriy parolni kiriting'),
    new_password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: 'Parollar mos emas' })

export const redirectSchema = z.object({
  from_path: z.string().trim().regex(/^\/[^\s]*$/, "Yo'l / bilan boshlansin"),
  to_path: z.string().trim().regex(/^(\/|https?:\/\/)[^\s]*$/, "Yo'l / yoki https:// bilan boshlansin"),
  code: z.union([z.literal(301), z.literal(302)]),
})
