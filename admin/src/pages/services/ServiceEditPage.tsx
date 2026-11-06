import { Controller } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import { Wand2 } from 'lucide-react'
import { useEntityEditor } from '@/components/editor/useEntityEditor'
import { ConflictBanner, DraftBanner, EditorToolbar, FormErrorList } from '@/components/editor/EditorChrome'
import { SeoBlock } from '@/components/editor/SeoBlock'
import { Field, Section } from '@/components/form/Field'
import { PairListEditor, StringListEditor, TagInput } from '@/components/form/ListEditors'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { PageError, PageLoading } from '@/components/layout/PageState'
import { useList } from '@/lib/resources'
import { ICONS, ILLOS, serviceSchema, type ServiceForm } from '@/lib/schemas'
import type { Project, Service } from '@/lib/types'
import { slugify } from '@/lib/utils'

const EMPTY: ServiceForm = {
  slug: '',
  title: '',
  icon: 'site',
  illo: 'site',
  short: '',
  who: [],
  includes: [],
  process: [],
  examples: [],
  stack: [],
  timeline: '',
  faq: [],
  price_from: '',
  duration: '',
  seo_title: '',
  seo_description: '',
}

function toForm(s: Service): ServiceForm {
  return {
    slug: s.slug ?? '',
    title: s.title ?? '',
    icon: s.icon ?? '',
    illo: s.illo ?? '',
    short: s.short ?? '',
    who: s.who ?? [],
    includes: s.includes ?? [],
    process: s.process ?? [],
    examples: s.examples ?? [],
    stack: s.stack ?? [],
    timeline: s.timeline ?? '',
    faq: (s.faq ?? []).map(([q, a]) => ({ q, a })),
    price_from: s.price_from ?? '',
    duration: s.duration ?? '',
    seo_title: s.seo_title ?? '',
    seo_description: s.seo_description ?? '',
  }
}

function fromForm(f: ServiceForm): Record<string, unknown> {
  return {
    ...f,
    faq: f.faq.map(({ q, a }) => [q, a]),
    price_from: f.price_from || null,
    duration: f.duration || null,
  }
}

/** Loyihalarni (slug) tanlash: xizmat sahifasidagi "Misollar". */
function ExamplesSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const projects = useList<Project>('projects', { limit: 50 })
  const items = projects.data?.items ?? []
  const toggle = (slug: string) => onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug])
  return (
    <fieldset className="grid max-h-64 gap-1 overflow-y-auto rounded-md border border-border p-2">
      <legend className="sr-only">Misol loyihalar</legend>
      {items.map((p) => (
        <label key={p.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
          <input type="checkbox" className="accent-[#CDF73D]" checked={value.includes(p.slug)} onChange={() => toggle(p.slug)} />
          <span className="truncate">{p.title}</span>
          <span className="ml-auto text-xs text-muted-foreground">{p.slug}</span>
        </label>
      ))}
      {value
        .filter((s) => !items.some((p) => p.slug === s))
        .map((s) => (
          <label key={s} className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground">
            <input type="checkbox" className="accent-[#CDF73D]" checked onChange={() => toggle(s)} /> {s} (topilmadi)
          </label>
        ))}
      {projects.isSuccess && items.length === 0 && <p className="p-2 text-sm text-muted-foreground">Loyihalar yo‘q</p>}
    </fieldset>
  )
}

export default function ServiceEditPage() {
  const { id } = useParams()
  const ed = useEntityEditor<Service, ServiceForm>({ res: 'services', id, basePath: '/xizmatlar', schema: serviceSchema, empty: EMPTY, toForm, fromForm })
  const { register, control, watch, setValue, formState } = ed.form
  const errors = formState.errors

  if (ed.loading) return <PageLoading />
  if (ed.loadError) return <PageError error={ed.loadError} />

  return (
    <form onSubmit={ed.submit} noValidate>
      <EditorToolbar
        backTo="/xizmatlar"
        backLabel="Xizmatlar ro'yxatiga"
        title={watch('title') || (ed.isNew ? 'Yangi xizmat' : '')}
        status={ed.record?.status}
        publishedAt={ed.record?.published_at}
        isNew={ed.isNew}
        saving={ed.saving}
        publishing={ed.publishing}
        dirty={formState.isDirty}
        onSave={() => void ed.submit()}
        onPublish={(s) => void ed.publish(s)}
        onPreview={() => void ed.preview()}
      />
      <div className="grid gap-4">
        {ed.conflict && <ConflictBanner onReload={ed.reload} />}
        {ed.draft && <DraftBanner draft={ed.draft} serverUpdatedAt={ed.record?.updated_at} onRestore={ed.restoreDraft} onDiscard={ed.discardDraft} />}
        <FormErrorList errors={ed.formErrors} />
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="grid gap-4">
            <Section title="Asosiy">
              <Field label="Sarlavha" htmlFor="title" error={errors.title?.message}>
                <Input id="title" aria-invalid={!!errors.title} {...register('title')} />
              </Field>
              <Field label="Slug (URL)" htmlFor="slug" error={errors.slug?.message} hint="/xizmatlar/<slug>">
                <div className="flex gap-2">
                  <Input id="slug" aria-invalid={!!errors.slug} {...register('slug')} />
                  <Button variant="outline" size="icon" aria-label="Sarlavhadan slug yasash" onClick={() => setValue('slug', slugify(watch('title')), { shouldDirty: true, shouldValidate: true })}>
                    <Wand2 />
                  </Button>
                </div>
              </Field>
              <Field label="Qisqa tavsif" htmlFor="short" error={errors.short?.message}>
                <Textarea id="short" rows={3} aria-invalid={!!errors.short} {...register('short')} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Narx (...dan)" htmlFor="price_from" error={errors.price_from?.message} hint="Masalan: $500">
                  <Input id="price_from" {...register('price_from')} />
                </Field>
                <Field label="Muddat" htmlFor="duration" error={errors.duration?.message} hint="Masalan: 2–4 hafta">
                  <Input id="duration" {...register('duration')} />
                </Field>
                <Field label="Vaqt jadvali" htmlFor="timeline" error={errors.timeline?.message}>
                  <Input id="timeline" {...register('timeline')} />
                </Field>
              </div>
              <Field label="Stek" htmlFor="stack">
                <Controller control={control} name="stack" render={({ field }) => <TagInput id="stack" label="Stek" value={field.value} onChange={field.onChange} />} />
              </Field>
            </Section>
            <Section title="Kimlar uchun">
              <Controller control={control} name="who" render={({ field }) => <StringListEditor label="Kim uchun" value={field.value} onChange={field.onChange} error={errors.who} />} />
            </Section>
            <Section title="Nimalar kiradi (imkoniyatlar)">
              <Controller control={control} name="includes" render={({ field }) => <StringListEditor label="Imkoniyat" value={field.value} onChange={field.onChange} error={errors.includes} />} />
            </Section>
            <Section title="Jarayon">
              <Controller control={control} name="process" render={({ field }) => <StringListEditor label="Qadam" addLabel="Qadam qo'shish" value={field.value} onChange={field.onChange} error={errors.process} />} />
            </Section>
            <Section title="FAQ">
              <Controller
                control={control}
                name="faq"
                render={({ field }) => <PairListEditor keys={['q', 'a']} labels={['Savol', 'Javob']} addLabel="Savol qo'shish" multilineSecond value={field.value} onChange={field.onChange} error={errors.faq} />}
              />
            </Section>
            <SeoBlock register={register} watch={watch} errors={errors} pathPrefix="/xizmatlar" fallbackDescription={watch('short')} />
          </div>
          <div className="grid content-start gap-4">
            <Section title="Ko‘rinish">
              <Field label="Ikonka" htmlFor="icon">
                <Select id="icon" {...register('icon')}>
                  {ICONS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Illyustratsiya" htmlFor="illo">
                <Select id="illo" {...register('illo')}>
                  {ILLOS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </Select>
              </Field>
            </Section>
            <Section title="Misollar" description="Xizmat sahifasida ko'rsatiladigan loyihalar">
              <Controller control={control} name="examples" render={({ field }) => <ExamplesSelect value={field.value} onChange={field.onChange} />} />
            </Section>
          </div>
        </div>
      </div>
    </form>
  )
}
