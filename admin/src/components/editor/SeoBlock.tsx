import type { FieldErrors, UseFormRegister, UseFormWatch } from 'react-hook-form'
import { Input, Textarea } from '@/components/ui/input'
import { CharCount, Field, Section } from '@/components/form/Field'
import { SITE_URL } from '@/lib/utils'

interface SeoFields {
  seo_title: string
  seo_description: string
  title: string
  slug: string
}

/** SEO bloki + Google qidiruv natijasi ko'rinishi. */
export function SeoBlock({
  register,
  watch,
  errors,
  pathPrefix,
  fallbackDescription,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch: UseFormWatch<any>
  errors: FieldErrors<SeoFields>
  pathPrefix: string
  fallbackDescription?: string
}) {
  const seoTitle: string = watch('seo_title') ?? ''
  const seoDesc: string = watch('seo_description') ?? ''
  const title: string = watch('title') ?? ''
  const slug: string = watch('slug') ?? ''
  const shownTitle = (seoTitle || title || 'Sarlavha') + ' — Jamolxon'
  const shownDesc = seoDesc || fallbackDescription || "Tavsif yo'q: Google sahifadan o'zi parcha oladi."
  const host = SITE_URL.replace(/^https?:\/\//, '')
  return (
    <Section title="SEO" description="Bo'sh qolsa, sarlavha va qisqa tavsif ishlatiladi">
      <Field label="SEO sarlavha" htmlFor="seo_title" error={errors.seo_title?.message} hint={<CharCount value={seoTitle} max={60} />}>
        <Input id="seo_title" aria-invalid={!!errors.seo_title} {...register('seo_title')} />
      </Field>
      <Field label="SEO tavsif" htmlFor="seo_description" error={errors.seo_description?.message} hint={<CharCount value={seoDesc} max={155} />}>
        <Textarea id="seo_description" rows={3} aria-invalid={!!errors.seo_description} {...register('seo_description')} />
      </Field>
      <div className="rounded-md bg-white p-4 font-[arial,sans-serif] text-left" aria-label="Google ko'rinishi" data-testid="google-preview">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f1f3f4] text-xs font-bold text-[#250104]">J</span>
          <div className="leading-tight">
            <div className="text-sm text-[#202124]">Jamolxon</div>
            <div className="truncate text-xs text-[#4d5156]">
              {host} › {pathPrefix.replace(/^\//, '')} › {slug || '...'}
            </div>
          </div>
        </div>
        <div className="mt-1 truncate text-xl leading-snug text-[#1a0dab]">{shownTitle.length > 63 ? shownTitle.slice(0, 60) + '...' : shownTitle}</div>
        <div className="line-clamp-2 text-sm text-[#4d5156]">{shownDesc.length > 158 ? shownDesc.slice(0, 155) + '...' : shownDesc}</div>
      </div>
    </Section>
  )
}
