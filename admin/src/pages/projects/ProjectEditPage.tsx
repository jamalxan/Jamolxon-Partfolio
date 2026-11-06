import { Controller } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import { Wand2 } from 'lucide-react'
import { useEntityEditor } from '@/components/editor/useEntityEditor'
import { ConflictBanner, DraftBanner, EditorToolbar, FormErrorList } from '@/components/editor/EditorChrome'
import { SeoBlock } from '@/components/editor/SeoBlock'
import { Field, Section } from '@/components/form/Field'
import { PairListEditor, SectionsEditor, StringListEditor, TagInput } from '@/components/form/ListEditors'
import { CoverPicker, GalleryPicker } from '@/components/media/MediaPicker'
import { Button } from '@/components/ui/button'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/input'
import { PageError, PageLoading } from '@/components/layout/PageState'
import { useList } from '@/lib/resources'
import { ILLOS, PROJECT_CATEGORIES, projectSchema, type ProjectForm } from '@/lib/schemas'
import type { Category, Project } from '@/lib/types'
import { slugify } from '@/lib/utils'

export const EMPTY_PROJECT: ProjectForm = {
  slug: '',
  title: '',
  subtitle: '',
  category: 'prod',
  url: '',
  year: String(new Date().getFullYear()),
  role: '',
  stack: [],
  summary: '',
  sections: [],
  results: [],
  links: [],
  illo: 'dashboard',
  image: '',
  cover_id: null,
  gallery: [],
  seo_title: '',
  seo_description: '',
  is_featured: false,
}

export function projectToForm(p: Project): ProjectForm {
  return {
    slug: p.slug ?? '',
    title: p.title ?? '',
    subtitle: p.subtitle ?? '',
    category: p.category ?? 'prod',
    url: p.url ?? '',
    year: p.year ?? '',
    role: p.role ?? '',
    stack: p.stack ?? [],
    summary: p.summary ?? '',
    sections: (p.sections ?? []).map((s) => ({ h: s.h, p: s.p?.length ? s.p : [''] })),
    results: p.results ?? [],
    links: p.links ?? [],
    illo: p.illo ?? '',
    image: p.image ?? '',
    cover_id: p.cover_id ?? null,
    gallery: p.gallery ?? [],
    seo_title: p.seo_title ?? '',
    seo_description: p.seo_description ?? '',
    is_featured: !!p.is_featured,
  }
}

export function projectFromForm(f: ProjectForm): Record<string, unknown> {
  return { ...f, image: f.image ? f.image : null }
}

const CATEGORY_FALLBACK: Record<string, string> = {
  prod: 'Real ishlayotgan',
  pm: 'Loyiha menejeri sifatida',
  own: "O'zim uchun qilganlarim",
  sale: 'Tayyor yechimlar — sotuvda',
}

export default function ProjectEditPage() {
  const { id } = useParams()
  const ed = useEntityEditor<Project, ProjectForm>({
    res: 'projects',
    id,
    basePath: '/loyihalar',
    schema: projectSchema,
    empty: EMPTY_PROJECT,
    toForm: projectToForm,
    fromForm: projectFromForm,
  })
  const cats = useList<Category>('categories', { limit: 50 })
  const { form } = ed
  const { register, control, watch, setValue, formState } = form
  const errors = formState.errors

  if (ed.loading) return <PageLoading />
  if (ed.loadError) return <PageError error={ed.loadError} />

  const catLabel = (slug: string) => cats.data?.items.find((c) => c.slug === slug)?.title ?? CATEGORY_FALLBACK[slug] ?? slug

  return (
    <form onSubmit={ed.submit} noValidate>
      <EditorToolbar
        backTo="/loyihalar"
        backLabel="Loyihalar ro'yxatiga"
        title={watch('title') || (ed.isNew ? 'Yangi loyiha' : '')}
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
              <Field label="Slug (URL)" htmlFor="slug" error={errors.slug?.message} hint="/loyihalar/<slug>. O'zgarsa, eski URL 301 bilan yo'naltiriladi.">
                <div className="flex gap-2">
                  <Input id="slug" aria-invalid={!!errors.slug} {...register('slug')} />
                  <Button variant="outline" size="icon" aria-label="Sarlavhadan slug yasash" onClick={() => setValue('slug', slugify(watch('title')), { shouldDirty: true, shouldValidate: true })}>
                    <Wand2 />
                  </Button>
                </div>
              </Field>
              <Field label="Qisqa tavsif (subtitle)" htmlFor="subtitle" error={errors.subtitle?.message}>
                <Input id="subtitle" {...register('subtitle')} />
              </Field>
              <Field label="Qisqacha mazmun" htmlFor="summary" error={errors.summary?.message}>
                <Textarea id="summary" rows={4} {...register('summary')} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Kategoriya" htmlFor="category" error={errors.category?.message}>
                  <Select id="category" {...register('category')}>
                    {PROJECT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {catLabel(c)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Yil" htmlFor="year" error={errors.year?.message}>
                  <Input id="year" inputMode="numeric" {...register('year')} />
                </Field>
                <Field label="Rolim" htmlFor="role" error={errors.role?.message}>
                  <Input id="role" {...register('role')} />
                </Field>
              </div>
              <Field label="Sayt havolasi" htmlFor="url" error={errors.url?.message}>
                <Input id="url" type="url" placeholder="https://" {...register('url')} />
              </Field>
              <Field label="Stek" htmlFor="stack">
                <Controller control={control} name="stack" render={({ field }) => <TagInput id="stack" label="Stek" value={field.value} onChange={field.onChange} />} />
              </Field>
            </Section>

            <Section title="Bo‘limlar" description="Har bir bo'lim: sarlavha va paragraflar (Muammo, Yechim, Texnik tomoni...)">
              <Controller control={control} name="sections" render={({ field }) => <SectionsEditor value={field.value} onChange={field.onChange} error={errors.sections} />} />
            </Section>

            <Section title="Natijalar">
              <Controller control={control} name="results" render={({ field }) => <StringListEditor label="Natija" addLabel="Natija qo'shish" value={field.value} onChange={field.onChange} error={errors.results} />} />
            </Section>

            <Section title="Havolalar">
              <Controller
                control={control}
                name="links"
                render={({ field }) => <PairListEditor keys={['label', 'url']} labels={['Nomi', 'URL']} addLabel="Havola qo'shish" value={field.value} onChange={field.onChange} error={errors.links} />}
              />
            </Section>

            <Section title="Galereya">
              <Controller control={control} name="gallery" render={({ field }) => <GalleryPicker value={field.value} onChange={field.onChange} />} />
            </Section>

            <SeoBlock register={register} watch={watch} errors={errors} pathPrefix="/loyihalar" fallbackDescription={watch('summary')} />
          </div>

          <div className="grid content-start gap-4">
            <Section title="Ko‘rinish">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox {...register('is_featured')} /> Bosh sahifada ko‘rsatish (featured)
              </label>
              <Field label="Illyustratsiya" htmlFor="illo">
                <Select id="illo" {...register('illo')}>
                  <option value="">— yo‘q —</option>
                  {ILLOS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Muqova">
                <Controller control={control} name="cover_id" render={({ field }) => <CoverPicker value={field.value} onChange={field.onChange} />} />
              </Field>
              <Field label="Tashqi rasm URL (ixtiyoriy)" htmlFor="image" error={errors.image?.message}>
                <Input id="image" placeholder="https://media.jamolxon.uz/..." {...register('image')} />
              </Field>
            </Section>
          </div>
        </div>
      </div>
    </form>
  )
}
