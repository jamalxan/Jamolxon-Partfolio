import * as React from 'react'
import { Controller } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import { Clock, Wand2 } from 'lucide-react'
import { useEntityEditor } from '@/components/editor/useEntityEditor'
import { ConflictBanner, DraftBanner, EditorToolbar, FormErrorList } from '@/components/editor/EditorChrome'
import { SeoBlock } from '@/components/editor/SeoBlock'
import { Field, Section } from '@/components/form/Field'
import { TagInput } from '@/components/form/ListEditors'
import { MarkdownEditor } from '@/components/form/MarkdownEditor'
import { CoverPicker } from '@/components/media/MediaPicker'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { PageError, PageLoading } from '@/components/layout/PageState'
import { useList } from '@/lib/resources'
import { postSchema, type PostForm } from '@/lib/schemas'
import type { ContentStatus, Post, Tag } from '@/lib/types'
import { formatDateTime, isoToLocalInput, localInputToIso, readingMinutes, slugify } from '@/lib/utils'

const EMPTY: PostForm = { slug: '', title: '', excerpt: '', body_md: '', tags: [], cover_id: null, seo_title: '', seo_description: '' }

function toForm(p: Post): PostForm {
  return {
    slug: p.slug ?? '',
    title: p.title ?? '',
    excerpt: p.excerpt ?? '',
    body_md: p.body_md ?? '',
    tags: p.tags ?? [],
    cover_id: p.cover_id ?? null,
    seo_title: p.seo_title ?? '',
    seo_description: p.seo_description ?? '',
  }
}
const fromForm = (f: PostForm): Record<string, unknown> => ({ ...f })

export default function PostEditPage() {
  const { id } = useParams()
  const ed = useEntityEditor<Post, PostForm>({ res: 'posts', id, basePath: '/blog', schema: postSchema, empty: EMPTY, toForm, fromForm })
  const { register, control, watch, setValue, formState } = ed.form
  const errors = formState.errors
  const tags = useList<Tag>('tags', { limit: 50 })
  const [scheduleAt, setScheduleAt] = React.useState('')
  const recordPublishedAt = ed.record?.published_at
  React.useEffect(() => {
    setScheduleAt(isoToLocalInput(recordPublishedAt))
  }, [recordPublishedAt])

  const body = watch('body_md')
  const localMinutes = React.useMemo(() => readingMinutes(body ?? ''), [body])

  if (ed.loading) return <PageLoading />
  if (ed.loadError) return <PageError error={ed.loadError} />

  const scheduleIso = localInputToIso(scheduleAt)
  const onPublish = (s: ContentStatus) => void ed.publish(s, s === 'published' ? scheduleIso : null)

  return (
    <form onSubmit={ed.submit} noValidate>
      <EditorToolbar
        backTo="/blog"
        backLabel="Blog ro'yxatiga"
        title={watch('title') || (ed.isNew ? 'Yangi post' : '')}
        status={ed.record?.status}
        publishedAt={ed.record?.published_at}
        isNew={ed.isNew}
        saving={ed.saving}
        publishing={ed.publishing}
        dirty={formState.isDirty}
        onSave={() => void ed.submit()}
        onPublish={onPublish}
        onPreview={() => void ed.preview()}
        scheduleAt={scheduleIso}
      />
      <div className="grid gap-4">
        {ed.conflict && <ConflictBanner onReload={ed.reload} />}
        {ed.draft && <DraftBanner draft={ed.draft} serverUpdatedAt={ed.record?.updated_at} onRestore={ed.restoreDraft} onDiscard={ed.discardDraft} />}
        <FormErrorList errors={ed.formErrors} />
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="grid gap-4">
            <Section title="Asosiy">
              <Field label="Sarlavha" htmlFor="title" error={errors.title?.message}>
                <Input id="title" aria-invalid={!!errors.title} {...register('title')} />
              </Field>
              <Field label="Slug (URL)" htmlFor="slug" error={errors.slug?.message} hint="/blog/<slug>">
                <div className="flex gap-2">
                  <Input id="slug" aria-invalid={!!errors.slug} {...register('slug')} />
                  <Button variant="outline" size="icon" aria-label="Sarlavhadan slug yasash" onClick={() => setValue('slug', slugify(watch('title')), { shouldDirty: true, shouldValidate: true })}>
                    <Wand2 />
                  </Button>
                </div>
              </Field>
              <Field label="Qisqa mazmun" htmlFor="excerpt" error={errors.excerpt?.message}>
                <Textarea id="excerpt" rows={3} {...register('excerpt')} />
              </Field>
            </Section>
            <Section
              title="Matn (Markdown)"
              actions={
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-testid="reading-time">
                  <Clock className="h-3.5 w-3.5" /> ~{ed.record?.reading_min && !formState.isDirty ? ed.record.reading_min : localMinutes} daqiqa o‘qish
                </span>
              }
            >
              <Controller control={control} name="body_md" render={({ field }) => <MarkdownEditor id="body_md" value={field.value} onChange={field.onChange} invalid={!!errors.body_md} />} />
            </Section>
            <SeoBlock register={register} watch={watch} errors={errors} pathPrefix="/blog" fallbackDescription={watch('excerpt')} />
          </div>
          <div className="grid content-start gap-4">
            <Section title="Nashr">
              <Field label="Nashr vaqti" htmlFor="published_at" hint="Kelajakdagi vaqt tanlansa, post o'sha paytda avtomatik chiqadi. Bo'sh — hozir.">
                <Input id="published_at" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} disabled={ed.isNew} />
              </Field>
              {ed.record?.published_at && <p className="text-xs text-muted-foreground">Joriy: {formatDateTime(ed.record.published_at)}</p>}
              {ed.isNew && <p className="text-xs text-muted-foreground">Avval saqlang, keyin nashr qilasiz.</p>}
            </Section>
            <Section title="Teglar">
              <Controller
                control={control}
                name="tags"
                render={({ field }) => <TagInput label="Teglar" value={field.value} onChange={field.onChange} suggestions={(tags.data?.items ?? []).map((t) => t.title)} />}
              />
            </Section>
            <Section title="Muqova">
              <Controller control={control} name="cover_id" render={({ field }) => <CoverPicker value={field.value} onChange={field.onChange} />} />
            </Section>
          </div>
        </div>
      </div>
    </form>
  )
}
