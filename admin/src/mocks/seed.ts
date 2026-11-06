// Soxta ma'lumotlar (MSW): backend/seed/content.json dan qisqartirilgan namuna.
import type { AuditLog, Category, Lead, Media, Offer, Post, Project, Redirect, Service, Settings, Step, Tag, User } from '@/lib/types'

export const MOCK_PASSWORD = 'parol-namuna-123'
export const MOCK_TOTP = '123456'
export const MOCK_BACKUP_CODE = 'abcd-1234'

export function uid(): string {
  return crypto.randomUUID()
}

const T0 = '2026-10-01T09:00:00Z'
const iso = (daysAgo: number, hour = 10) => new Date(Date.UTC(2026, 10, 6 - daysAgo, hour, 0, 0)).toISOString()

function svgThumb(color: string, label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="50%" fill="#250104" font-family="sans-serif" font-size="64" text-anchor="middle">${label}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export interface MockUser extends User {
  password: string
}

export function seedUsers(): MockUser[] {
  return [
    { id: 'u-owner', email: 'owner@jamolxon.uz', name: 'Jamolxon Yo‘ldoshaliyev', role: 'owner', is_active: true, last_login_at: iso(1), totp_enabled: true, password: MOCK_PASSWORD },
    { id: 'u-editor', email: 'editor@jamolxon.uz', name: 'Dilnoza Editor', role: 'editor', is_active: true, last_login_at: iso(3), totp_enabled: true, password: MOCK_PASSWORD },
    { id: 'u-new', email: 'yangi@jamolxon.uz', name: 'Yangi Owner', role: 'owner', is_active: true, last_login_at: null, totp_enabled: false, password: MOCK_PASSWORD },
  ]
}

export function seedMedia(): Media[] {
  const m = (id: string, name: string, color: string, alt: string, used: Media['used_in']): Media => ({
    id,
    url: svgThumb(color, name.split('.')[0]),
    original_name: name,
    mime: 'image/png',
    size_bytes: 182_000,
    width: 960,
    height: 720,
    variants: { webp: { '960': svgThumb(color, name.split('.')[0]) } },
    alt,
    blurhash: null,
    used_in: used,
    created_at: T0,
  })
  return [
    m('m-1', 'socialauto.png', '#CDF73D', 'SocialAuto boshqaruv paneli', [{ entity: 'projects', id: 'p-1', title: 'SocialAuto' }]),
    m('m-2', 'vocably.png', '#FFF1DC', 'Vocably mobil ilovasi', []),
    m('m-3', 'promtchi.png', '#e6ff7a', 'Promtchi.uz bosh sahifasi', []),
  ]
}

const base = { created_at: T0, updated_at: '2026-11-01T10:00:00.000Z' }

export function seedProjects(): Project[] {
  return [
    {
      ...base,
      id: 'p-1',
      slug: 'socialauto',
      title: 'SocialAuto',
      subtitle: 'Instagram izohiga avtomatik javob va DM yuboruvchi SaaS',
      category: 'prod',
      url: 'https://socialauto.uz',
      year: '2025',
      role: 'Backend, frontend, mahsulot rejasi',
      stack: ['FastAPI', 'ARQ', 'PostgreSQL', 'Redis', 'Next.js 14'],
      summary: "«Narxi?» deb yozgan yuzlab izohga qo'lda javob berib bo'lmaydi. SocialAuto kalit so'zli izohni ushlaydi va Direct'ga havola yuboradi.",
      sections: [
        { h: 'Muammo', p: ['Instagram orqali sotadigan biznesda bitta post ostiga yuzlab bir xil izoh tushadi.'] },
        { h: 'Yechim', p: ["Biznes kalit so'zlarni va javob matnini sozlaydi.", 'Keyingi bosqich — lead assistant.'] },
      ],
      results: ['68 ta unit test', 'Webhook 1 soniyadan tez qabul qilinadi'],
      links: [{ label: 'Sayt', url: 'https://socialauto.uz' }],
      illo: 'dashboard',
      image: null,
      cover_id: 'm-1',
      gallery: [{ media_id: 'm-1', caption: 'Boshqaruv paneli' }],
      seo_title: 'SocialAuto — Instagram avto-javob',
      seo_description: "Instagram izohlariga avtomatik javob va DM yuboruvchi SaaS.",
      is_featured: true,
      status: 'published',
      published_at: '2026-09-01T10:00:00Z',
      sort_order: 0,
    },
    {
      ...base,
      id: 'p-2',
      slug: 'vocably',
      title: 'Vocably',
      subtitle: "So'z yodlash uchun Telegram bot",
      category: 'own',
      url: '',
      year: '2024',
      role: 'To‘liq stek',
      stack: ['Python', 'aiogram'],
      summary: "Har kuni 10 ta yangi so'z, takrorlash algoritmi bilan.",
      sections: [],
      results: [],
      links: [],
      illo: 'bot',
      image: null,
      cover_id: null,
      gallery: [],
      seo_title: '',
      seo_description: '',
      is_featured: false,
      status: 'draft',
      published_at: null,
      sort_order: 1,
    },
    {
      ...base,
      id: 'p-3',
      slug: 'promtchi-uz',
      title: 'Promtchi.uz',
      subtitle: "AI bo'yicha o'zbekcha o'quv platforma",
      category: 'pm',
      url: 'https://promtchi.uz',
      year: '2025',
      role: 'Loyiha menejeri',
      stack: ['Next.js', 'Tailwind'],
      summary: "Jamoa bilan qurilgan ta'lim platformasi.",
      sections: [],
      results: [],
      links: [],
      illo: 'site',
      image: null,
      cover_id: null,
      gallery: [],
      seo_title: '',
      seo_description: '',
      is_featured: false,
      status: 'archived',
      published_at: '2025-05-01T10:00:00Z',
      sort_order: 2,
    },
  ]
}

export function seedServices(): Service[] {
  return [
    {
      ...base,
      id: 's-1',
      slug: 'web-saytlar',
      title: 'Web saytlar',
      icon: 'site',
      illo: 'site',
      short: "Korporativ sayt, landing, katalog — tez ochiladigan, qidiruvga tayyor.",
      who: ['Yangi biznes — birinchi sayt kerak'],
      includes: ['Tuzilma va matn rejasi', 'Dizayn: mobil va desktop'],
      process: ['Suhbat', 'Tuzilma', 'Dizayn', 'Qurish va deploy'],
      examples: ['promtchi-uz'],
      stack: ['Next.js', 'Tailwind'],
      timeline: 'Landing — 1–2 hafta',
      faq: [['Matnni kim yozadi?', 'Tuzilmani men beraman; matnni birga yozamiz.']],
      price_from: '$500',
      duration: '1–5 hafta',
      seo_title: '',
      seo_description: '',
      status: 'published',
      published_at: '2026-09-01T10:00:00Z',
      sort_order: 0,
    },
    {
      ...base,
      id: 's-2',
      slug: 'crm-erp',
      title: 'CRM/ERP tizimlar',
      icon: 'erp',
      illo: 'office',
      short: 'Biznes jarayonlarini bitta tizimda boshqarish.',
      who: [],
      includes: [],
      process: [],
      examples: [],
      stack: [],
      timeline: '',
      faq: [],
      price_from: null,
      duration: null,
      seo_title: '',
      seo_description: '',
      status: 'draft',
      published_at: null,
      sort_order: 1,
    },
  ]
}

export function seedPosts(): Post[] {
  return [
    {
      ...base,
      id: 'b-1',
      slug: 'ai-avval-backend',
      title: "Nega AI loyiha avval backend'dan boshlanadi",
      excerpt: '«AI qo‘shib beramiz» deganda ko‘pchilik modelni o‘ylaydi.',
      body_md: "## Ma'lumot qayerda?\n\nMijoz «bizga AI kerak» deydi. Men esa birinchi savolni beraman: **ma'lumot qayerda?**\n\n- Excel\n- Telegram guruhi\n",
      body_html: '',
      tags: ['AI', 'Backend'],
      cover_id: null,
      reading_min: 4,
      seo_title: '',
      seo_description: '',
      status: 'published',
      published_at: '2025-11-02T09:00:00Z',
      sort_order: 0,
    },
    {
      ...base,
      id: 'b-2',
      slug: 'lead-yoqotmaslik',
      title: "Leadni yo'qotmaslik: 5 qoida",
      excerpt: '',
      body_md: '',
      tags: [],
      body_html: '',
      cover_id: null,
      reading_min: 1,
      seo_title: '',
      seo_description: '',
      status: 'draft',
      published_at: null,
      sort_order: 1,
    },
  ]
}

export function seedCategories(): Category[] {
  return [
    { id: 'c-1', slug: 'prod', title: 'Real ishlayotgan', short: 'Production', badge: 'b-live', dot: 'Live', description: 'Hozir ishlayotgan tizimlar', color: '#CDF73D', sort_order: 0, updated_at: base.updated_at },
    { id: 'c-2', slug: 'pm', title: 'Loyiha menejeri sifatida', short: 'PM', badge: 'b-pm', dot: 'PM', description: '', color: '#FFF1DC', sort_order: 1, updated_at: base.updated_at },
    { id: 'c-3', slug: 'own', title: "O'zim uchun qilganlarim", short: 'Shaxsiy', badge: 'b-own', dot: 'Shaxsiy', description: '', color: '#D71A06', sort_order: 2, updated_at: base.updated_at },
    { id: 'c-4', slug: 'sale', title: 'Tayyor yechimlar — sotuvda', short: 'Sotuvda', badge: 'b-sale', dot: 'Sotuvda', description: '', color: '#e6ff7a', sort_order: 3, updated_at: base.updated_at },
  ]
}

export function seedTags(): Tag[] {
  return ['AI', 'Backend', 'Arxitektura', 'Telegram'].map((t, i) => ({ id: `t-${i + 1}`, slug: t.toLowerCase(), title: t, sort_order: i, updated_at: base.updated_at }))
}

export function seedOffers(): Offer[] {
  return [
    { id: 'o-1', key: 'aloqa', title: 'Mijozlar bilan aloqa', icon: 'chat', problem: 'Xabarlarga kech javob beriladi.', solution: 'AI avto-javob 24/7.', examples: [['SocialAuto', 'socialauto']], sort_order: 0, updated_at: base.updated_at },
    { id: 'o-2', key: 'hisobot', title: 'Hisobotlar', icon: 'ai', problem: "Excel'da qo'lda hisob.", solution: 'Avtomatik dashboard.', examples: [], sort_order: 1, updated_at: base.updated_at },
  ]
}

export function seedSteps(): Step[] {
  return [
    { id: 'st-1', title: 'Tahlil va TZ', text: "Biznes jarayonini o'rganaman.", get: 'Texnik topshiriq va muddatlar.', sort_order: 0, updated_at: base.updated_at },
    { id: 'st-2', title: 'Dizayn', text: 'Maket va prototip.', get: 'Tasdiqlangan maket.', sort_order: 1, updated_at: base.updated_at },
    { id: 'st-3', title: 'Qurish', text: 'Bosqichma-bosqich ishlab chiqish.', get: 'Ishlaydigan tizim.', sort_order: 2, updated_at: base.updated_at },
  ]
}

export function seedLeads(): Lead[] {
  const l = (n: number, name: string, status: Lead['status'], contact_type: Lead['contact_type'], contact_value: string, service: string, daysAgo: number): Lead => ({
    id: `l-${n}`,
    number: 120 + n,
    name,
    contact_type,
    contact_value,
    service,
    budget_range: '1000-3000',
    deadline: '1_oy',
    message: "O'quv markazimiz uchun CRM kerak. O'quvchilar, to'lovlar va dars jadvali.",
    status,
    source_page: `/xizmatlar/${service}`,
    utm: { utm_source: 'instagram' },
    spam_score: status === 'spam' ? 0.9 : 0.05,
    assigned_to: null,
    created_at: iso(daysAgo),
    updated_at: iso(daysAgo),
    events: [],
  })
  return [
    l(1, 'Aziz Karimov', 'new', 'telegram', '@aziz_k', 'crm-erp', 0),
    l(2, 'Malika', 'new', 'phone', '+998901234567', 'web-saytlar', 1),
    l(3, 'Bekzod', 'contacted', 'email', 'bekzod@example.uz', 'crm-erp', 3),
    l(4, 'Nodira', 'proposal_sent', 'telegram', '@nodira_s', 'web-saytlar', 6),
    l(5, 'Sardor', 'won', 'phone', '+998935556677', 'crm-erp', 12),
    l(6, 'Spam Bot', 'spam', 'email', 'win@spam.biz', 'boshqa', 2),
  ]
}

export function seedSettings(): Settings {
  return {
    contact: {
      tg: 'jamalxon',
      tgUrl: 'https://t.me/jamalxon',
      gh: 'github.com/jamalxan',
      ghUrl: 'https://github.com/jamalxan',
      ig: '@jamalxann',
      igUrl: 'https://instagram.com/jamalxann',
      mailParts: ['jamolxonyoldashaliyev3', 'gmail.com'],
      telParts: ['+998', '93', '160', '67', '06'],
      studio: 'promtchi.uz',
      studioUrl: 'https://promtchi.uz',
    },
    social: { LinkedIn: 'https://linkedin.com/in/jamolxon' },
    seo: { title: 'Jamolxon — backend va AI yechimlar', description: 'Biznes uchun web, bot va AI tizimlar.', og_image: null },
    telegram: { chat_id: '123456789' },
  }
}

export function seedRedirects(): Redirect[] {
  return [{ id: 'r-1', from_path: '/loyiha/eski', to_path: '/loyihalar/socialauto', code: 301 }]
}

export function seedAudit(): AuditLog[] {
  return [
    {
      id: 'a-1',
      actor: { id: 'u-owner', email: 'owner@jamolxon.uz' },
      action: 'update',
      entity: 'projects',
      entity_id: 'p-1',
      diff: { title: ['Social Auto', 'SocialAuto'], is_featured: [false, true] },
      ip: '185.0.0.1',
      created_at: iso(1),
    },
  ]
}
