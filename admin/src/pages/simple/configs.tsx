import { SimpleCrudPage, type SimpleCrudConfig } from './SimpleCrudPage'
import { categorySchema, ICONS, offerSchema, stepSchema, tagSchema } from '@/lib/schemas'

const s = (v: unknown) => (typeof v === 'string' ? v : '')

const categories: SimpleCrudConfig = {
  res: 'categories',
  title: 'Kategoriyalar',
  description: "Loyiha kategoriyalari (prod, pm, own, sale) va ularning ko'rinishi",
  singular: 'Kategoriya',
  schema: categorySchema,
  empty: { slug: '', title: '', short: '', badge: '', dot: '', description: '', color: '' },
  fields: [
    { name: 'title', label: 'Nomi', kind: 'text' },
    { name: 'slug', label: 'Slug', kind: 'text' },
    { name: 'short', label: 'Qisqa nomi', kind: 'text' },
    { name: 'badge', label: 'Beyjik klassi', kind: 'text', hint: 'Masalan: b-live' },
    { name: 'dot', label: 'Nuqta yozuvi', kind: 'text' },
    { name: 'description', label: 'Tavsif', kind: 'textarea' },
    { name: 'color', label: 'Rang', kind: 'color' },
  ],
  primary: (r) => s(r.title),
  secondary: (r) => s(r.slug),
}

const tags: SimpleCrudConfig = {
  res: 'tags',
  title: 'Teglar',
  description: 'Blog teglari',
  singular: 'Teg',
  schema: tagSchema,
  empty: { title: '', slug: '' },
  fields: [
    { name: 'title', label: 'Nomi', kind: 'text' },
    { name: 'slug', label: 'Slug', kind: 'text' },
  ],
  primary: (r) => s(r.title),
  secondary: (r) => s(r.slug),
}

const offers: SimpleCrudConfig = {
  res: 'offers',
  title: 'AI yechimlar',
  description: 'Bosh sahifadagi "muammo → yechim" kartalari',
  singular: 'Yechim',
  schema: offerSchema,
  empty: { key: '', title: '', icon: 'ai', problem: '', solution: '', examples: [] },
  fields: [
    { name: 'title', label: 'Sarlavha', kind: 'text' },
    { name: 'key', label: 'Kalit (slug)', kind: 'text' },
    { name: 'icon', label: 'Ikonka', kind: 'select', options: ICONS },
    { name: 'problem', label: 'Muammo', kind: 'textarea' },
    { name: 'solution', label: 'Yechim', kind: 'textarea' },
    { name: 'examples', label: 'Misollar', kind: 'pairs', keys: ['label', 'slug'], labels: ['Nomi', 'Loyiha slug'], addLabel: "Misol qo'shish" },
  ],
  toForm: (r) => ({ ...r, examples: Array.isArray(r.examples) ? (r.examples as [string, string][]).map(([label, slug]) => ({ label, slug })) : [] }),
  fromForm: (f) => ({ ...f, examples: (f.examples as { label: string; slug: string }[]).map((e) => [e.label, e.slug]) }),
  primary: (r) => s(r.title),
  secondary: (r) => s(r.problem),
}

const steps: SimpleCrudConfig = {
  res: 'steps',
  title: 'Jarayon',
  description: 'Ish jarayoni qadamlari (bosh sahifa)',
  singular: 'Qadam',
  schema: stepSchema,
  empty: { title: '', text: '', get: '' },
  fields: [
    { name: 'title', label: 'Sarlavha', kind: 'text' },
    { name: 'text', label: 'Matn', kind: 'textarea' },
    { name: 'get', label: 'Natijada nima olasiz', kind: 'textarea' },
  ],
  primary: (r) => s(r.title),
  secondary: (r) => s(r.text),
}

export const CategoriesPage = () => <SimpleCrudPage config={categories} />
export const TagsPage = () => <SimpleCrudPage config={tags} />
export const OffersPage = () => <SimpleCrudPage config={offers} />
export const StepsPage = () => <SimpleCrudPage config={steps} />
