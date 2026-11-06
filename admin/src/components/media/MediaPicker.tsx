import * as React from 'react'
import { Check, FileText, ImageIcon, Plus, Search, Trash2, ArrowUp, ArrowDown, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMediaList } from '@/lib/resources'
import type { GalleryItem, Media } from '@/lib/types'
import { cn } from '@/lib/utils'

export function thumbUrl(m: Media): string | null {
  if (!m.mime.startsWith('image/')) return null
  const webp = m.variants?.webp
  if (webp) {
    const sizes = Object.keys(webp).map(Number).sort((a, b) => a - b)
    const pick = sizes.find((s) => s >= 400) ?? sizes[sizes.length - 1]
    if (pick != null && webp[String(pick)]) return webp[String(pick)]
  }
  return m.url
}

export function MediaThumb({ media, className }: { media: Media | undefined; className?: string }) {
  const url = media ? thumbUrl(media) : null
  return (
    <div className={cn('flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-maroon-2', className)}>
      {url ? (
        <img src={url} alt={media?.alt ?? ''} loading="lazy" className="h-full w-full object-cover" />
      ) : media ? (
        <FileText className="h-8 w-8 text-muted-foreground" />
      ) : (
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
      )}
    </div>
  )
}

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = React.useState(v)
  React.useEffect(() => {
    const t = setTimeout(() => setD(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return d
}

function PickerDialog({ open, onOpenChange, multiple, initial, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; multiple: boolean; initial: string[]; onConfirm: (ids: string[]) => void }) {
  const [q, setQ] = React.useState('')
  const dq = useDebounced(q)
  const list = useMediaList(dq)
  const [selected, setSelected] = React.useState<string[]>(initial)
  React.useEffect(() => {
    if (open) setSelected(initial)
    // faqat ochilganda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const toggle = (id: string) => {
    if (!multiple) return setSelected([id])
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  const items = (list.data?.items ?? []).filter((m) => m.mime.startsWith('image/'))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Media tanlash</DialogTitle>
          <DialogDescription>Yangi rasm yuklash uchun "Media" bo'limiga o'ting.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Qidirish (nomi yoki alt)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Media qidirish" />
        </div>
        <div className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
          {items.map((m) => {
            const on = selected.includes(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                aria-pressed={on}
                aria-label={m.alt || m.original_name}
                className={cn('relative rounded-md border-2 p-1 text-left', on ? 'border-primary' : 'border-transparent hover:border-border')}
              >
                <MediaThumb media={m} />
                <span className="mt-1 block truncate text-xs">{m.alt || m.original_name}</span>
                {on && (
                  <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            )
          })}
          {list.isSuccess && items.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Rasm topilmadi</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button
            onClick={() => {
              onConfirm(selected)
              onOpenChange(false)
            }}
          >
            Tanlash {multiple && selected.length > 0 ? `(${selected.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function useMediaById() {
  const list = useMediaList('')
  return React.useMemo(() => new Map((list.data?.items ?? []).map((m) => [m.id, m])), [list.data])
}

export function CoverPicker({ value, onChange, label = 'Muqova rasmi' }: { value: string | null; onChange: (id: string | null) => void; label?: string }) {
  const [open, setOpen] = React.useState(false)
  const byId = useMediaById()
  const media = value ? byId.get(value) : undefined
  return (
    <div className="grid gap-2">
      {value ? (
        <div className="relative w-full max-w-xs">
          <MediaThumb media={media} />
          <Button variant="secondary" size="icon" className="absolute right-2 top-2" aria-label={`${label}ni olib tashlash`} onClick={() => onChange(null)}>
            <X />
          </Button>
        </div>
      ) : null}
      <div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <ImageIcon /> {value ? 'Almashtirish' : 'Media’dan tanlash'}
        </Button>
      </div>
      <PickerDialog open={open} onOpenChange={setOpen} multiple={false} initial={value ? [value] : []} onConfirm={(ids) => onChange(ids[0] ?? null)} />
    </div>
  )
}

export function GalleryPicker({ value, onChange }: { value: GalleryItem[]; onChange: (v: GalleryItem[]) => void }) {
  const [open, setOpen] = React.useState(false)
  const byId = useMediaById()
  const moveItem = (i: number, to: number) => {
    if (to < 0 || to >= value.length) return
    const next = value.slice()
    const [x] = next.splice(i, 1)
    next.splice(to, 0, x)
    onChange(next)
  }
  return (
    <div className="grid gap-3">
      {value.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {value.map((g, i) => (
            <li key={g.media_id} className="grid gap-2 rounded-md border border-border p-2">
              <MediaThumb media={byId.get(g.media_id)} />
              <Input aria-label={`Rasm ${i + 1} izohi`} placeholder="Izoh (ixtiyoriy)" value={g.caption} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} />
              <div className="flex justify-end gap-0.5">
                <Button variant="ghost" size="icon" aria-label="Chapga" disabled={i === 0} onClick={() => moveItem(i, i - 1)}>
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon" aria-label="O‘ngga" disabled={i === value.length - 1} onClick={() => moveItem(i, i + 1)}>
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Rasm ${i + 1}ni olib tashlash`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus /> Galereyaga rasm qo‘shish
        </Button>
      </div>
      <PickerDialog
        open={open}
        onOpenChange={setOpen}
        multiple
        initial={value.map((g) => g.media_id)}
        onConfirm={(ids) => {
          const keep = value.filter((g) => ids.includes(g.media_id))
          const added = ids.filter((id) => !value.some((g) => g.media_id === id)).map((id) => ({ media_id: id, caption: '' }))
          onChange([...keep, ...added])
        }}
      />
    </div>
  )
}
