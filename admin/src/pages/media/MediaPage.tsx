import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, Loader2, Search, Trash2, UploadCloud, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage, isApiError } from '@/lib/api'
import { useList, useRemoveRecord } from '@/lib/resources'
import { mediaUploadSchema, MEDIA_MIME } from '@/lib/schemas'
import type { Media } from '@/lib/types'
import { cn, formatBytes, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { FieldError } from '@/components/form/Field'
import { EmptyState, PageError, PageHeader, PageLoading } from '@/components/layout/PageState'
import { MediaThumb } from '@/components/media/MediaPicker'
import { useDebouncedValue } from '@/components/ContentListPage'

const ENTITY_LABEL: Record<string, string> = { project: 'Loyiha', projects: 'Loyiha', post: 'Post', posts: 'Post', service: 'Xizmat', services: 'Xizmat', settings: 'Sozlamalar' }

export default function MediaPage() {
  const [q, setQ] = React.useState('')
  const dq = useDebouncedValue(q)
  const list = useList<Media>('media', { q: dq, limit: 50 })
  return (
    <div>
      <PageHeader title="Media" description="Rasm va PDF fayllar. Alt matn majburiy: u ko'zi ojizlar va SEO uchun." />
      <Uploader />
      <div className="relative my-4">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Nomi yoki alt bo'yicha qidirish" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Media qidirish" />
      </div>
      {list.isPending ? (
        <PageLoading />
      ) : list.isError ? (
        <PageError error={list.error} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="Fayl topilmadi" />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.data.items.map((m) => (
            <MediaCard key={m.id} media={m} />
          ))}
        </ul>
      )}
    </div>
  )
}

function Uploader() {
  const qc = useQueryClient()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [file, setFile] = React.useState<File | null>(null)
  const [alt, setAlt] = React.useState('')
  const [errors, setErrors] = React.useState<{ file?: string; alt?: string }>({})
  const [dragOver, setDragOver] = React.useState(false)
  // CSP img-src `blob:` ga ruxsat bermaydi (TZ 8), shuning uchun data: URL ishlatamiz
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  React.useEffect(() => {
    setPreviewUrl(null)
    if (!file || !file.type.startsWith('image/') || typeof FileReader === 'undefined') return
    const reader = new FileReader()
    reader.onload = () => setPreviewUrl(typeof reader.result === 'string' ? reader.result : null)
    reader.readAsDataURL(file)
    return () => reader.abort()
  }, [file])

  const upload = useMutation({
    mutationFn: (v: { file: File; alt: string }) => {
      const fd = new FormData()
      fd.append('file', v.file)
      fd.append('alt', v.alt)
      return api<Media>('/media', { method: 'POST', body: fd })
    },
    onSuccess: () => {
      toast.success('Yuklandi')
      setFile(null)
      setAlt('')
      setErrors({})
      void qc.invalidateQueries({ queryKey: ['media', 'list'] })
    },
    onError: (e) => {
      if (isApiError(e) && e.status === 422 && e.fieldErrors.length) {
        const next: { file?: string; alt?: string } = {}
        for (const fe of e.fieldErrors) {
          if (fe.field.endsWith('alt')) next.alt = fe.msg
          else next.file = fe.msg
        }
        setErrors(next)
      } else {
        toast.error(errorMessage(e))
      }
    },
  })

  const pick = (f: File | undefined | null) => {
    if (!f) return
    setFile(f)
    setErrors({})
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = mediaUploadSchema.safeParse({ file: file ?? undefined, alt })
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors
      setErrors({ file: fe.file?.[0], alt: fe.alt?.[0] })
      return
    }
    upload.mutate(parsed.data)
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 rounded-lg border border-border bg-card p-4">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          pick(e.dataTransfer.files?.[0])
        }}
        data-testid="dropzone"
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
          dragOver ? 'border-primary bg-primary/10' : 'border-border',
        )}
      >
        {file ? (
          <div className="flex items-center gap-3">
            {previewUrl ? <img src={previewUrl} alt="" className="h-16 w-16 rounded object-cover" /> : null}
            <div className="text-left text-sm">
              <div className="font-semibold">{file.name}</div>
              <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Faylni olib tashlash" onClick={() => setFile(null)}>
              <X />
            </Button>
          </div>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-primary" />
            <p className="text-sm">Faylni shu yerga tashlang yoki</p>
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              Fayl tanlash
            </Button>
            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, AVIF yoki PDF · 10 MB gacha · SVG qabul qilinmaydi</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={MEDIA_MIME.join(',')}
          aria-label="Fayl"
          data-testid="file-input"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
      <FieldError message={errors.file} />
      <div className="grid gap-1.5">
        <Label htmlFor="media-alt">Alt matn (majburiy)</Label>
        <Input id="media-alt" value={alt} aria-invalid={!!errors.alt} placeholder="Rasmda nima tasvirlangan?" onChange={(e) => setAlt(e.target.value)} />
        <FieldError message={errors.alt} />
      </div>
      <div>
        <Button type="submit" disabled={upload.isPending}>
          {upload.isPending ? <Loader2 className="animate-spin" /> : <UploadCloud />} Yuklash
        </Button>
      </div>
    </form>
  )
}

function MediaCard({ media }: { media: Media }) {
  const qc = useQueryClient()
  const [alt, setAlt] = React.useState(media.alt)
  React.useEffect(() => setAlt(media.alt), [media.alt])
  const remove = useRemoveRecord('media')
  const saveAlt = useMutation({
    mutationFn: () => api<Media>(`/media/${media.id}`, { method: 'PATCH', body: { alt: alt.trim() } }),
    onSuccess: () => {
      toast.success('Alt saqlandi')
      void qc.invalidateQueries({ queryKey: ['media', 'list'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const used = media.used_in?.length > 0
  return (
    <li className="grid content-start gap-2 rounded-lg border border-border bg-card p-3">
      <MediaThumb media={media} />
      <div className="min-w-0 text-xs text-muted-foreground">
        <div className="truncate font-medium text-foreground" title={media.original_name}>
          {media.original_name}
        </div>
        {media.width && media.height ? `${media.width}×${media.height} · ` : ''}
        {formatBytes(media.size_bytes)} · {formatDateTime(media.created_at)}
      </div>
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          if (!alt.trim()) return toast.error('Alt matn majburiy')
          saveAlt.mutate()
        }}
      >
        <Input aria-label={`${media.original_name} alt matni`} value={alt} onChange={(e) => setAlt(e.target.value)} className="h-8 text-xs" />
        <Button type="submit" size="sm" variant="secondary" disabled={alt === media.alt || saveAlt.isPending}>
          OK
        </Button>
      </form>
      <div className="text-xs">
        {used ? (
          <>
            <span className="text-muted-foreground">Ishlatilgan:</span>
            <ul className="mt-0.5 grid gap-0.5">
              {media.used_in.map((u) => (
                <li key={`${u.entity}-${u.id}`} className="truncate">
                  {ENTITY_LABEL[u.entity] ?? u.entity}: {u.title}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <span className="text-muted-foreground">Hech qayerda ishlatilmagan</span>
        )}
      </div>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(media.url)
              toast.success('Havola nusxalandi')
            } catch {
              toast.error("Nusxa olib bo'lmadi")
            }
          }}
        >
          <Copy /> URL
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          disabled={used || remove.isPending}
          title={used ? "Ishlatilayotgan faylni o'chirib bo'lmaydi" : "O'chirish"}
          aria-label={`${media.original_name}ni o'chirish`}
          onClick={() => {
            if (!window.confirm("Fayl o'chirilsinmi?")) return
            remove.mutate(media.id, {
              onSuccess: () => toast.success("O'chirildi"),
              onError: (e) => toast.error(isApiError(e) && e.status === 409 ? "Fayl ishlatilmoqda, avval undan foydalanishni olib tashlang" : errorMessage(e)),
            })
          }}
        >
          <Trash2 /> O‘chirish
        </Button>
      </div>
    </li>
  )
}
