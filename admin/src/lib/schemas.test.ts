import { describe, expect, it } from 'vitest'
import { normalizeField } from './form-errors'
import { mediaUploadSchema, postSchema, projectSchema, slug } from './schemas'
import { EMPTY_PROJECT } from '@/pages/projects/ProjectEditPage'

describe('Zod sxemalar (backend bilan bir xil)', () => {
  it.each(['crm', 'crm-erp', 'web-2025', 'a1-b2-c3'])('slug %s qabul qilinadi', (s) => {
    expect(slug.safeParse(s).success).toBe(true)
  })
  it.each(['', 'CRM', 'crm_erp', '-crm', 'crm-', 'crm--erp', "o'quv", 'crm erp'])('slug %j rad etiladi', (s) => {
    expect(slug.safeParse(s).success).toBe(false)
  })

  it('loyiha: sarlavha 2–120, SEO 60/155', () => {
    const ok = projectSchema.safeParse({ ...EMPTY_PROJECT, title: 'OK loyiha', slug: 'ok' })
    expect(ok.success).toBe(true)
    const bad = projectSchema.safeParse({ ...EMPTY_PROJECT, title: 'x', slug: 'ok', seo_title: 'a'.repeat(61), seo_description: 'b'.repeat(156) })
    expect(bad.success).toBe(false)
    const fields = bad.success ? [] : bad.error.issues.map((i) => i.path.join('.'))
    expect(fields).toEqual(expect.arrayContaining(['title', 'seo_title', 'seo_description']))
  })

  it("post: 10 tadan ko'p teg rad etiladi", () => {
    const r = postSchema.safeParse({ slug: 'a', title: 'Post', excerpt: '', body_md: '', tags: Array.from({ length: 11 }, (_, i) => `t${i}`), cover_id: null, seo_title: '', seo_description: '' })
    expect(r.success).toBe(false)
  })

  it('media: alt majburiy, SVG rad etiladi', () => {
    const png = new File(['x'], 'a.png', { type: 'image/png' })
    const svg = new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' })
    expect(mediaUploadSchema.safeParse({ file: png, alt: '  ' }).success).toBe(false)
    expect(mediaUploadSchema.safeParse({ file: svg, alt: 'logo' }).success).toBe(false)
    expect(mediaUploadSchema.safeParse({ file: png, alt: 'logo' }).success).toBe(true)
  })

  it('server field yo‘llarini RHF yo‘liga keltiradi', () => {
    expect(normalizeField('body.slug')).toBe('slug')
    expect(normalizeField('sections[0].h')).toBe('sections.0.h')
    expect(normalizeField('links.1.url')).toBe('links.1.url')
  })
})
