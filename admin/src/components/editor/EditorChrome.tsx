import * as React from 'react'
import { Link } from 'react-router-dom'
import { Archive, ArrowLeft, CalendarClock, ExternalLink, FileText, History, Loader2, RefreshCw, Rocket, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import type { ContentStatus } from '@/lib/types'
import type { StoredDraft } from '@/hooks/useAutosave'

export const STATUS_LABEL: Record<ContentStatus, string> = {
  draft: 'Qoralama',
  published: 'Nashr qilingan',
  archived: 'Arxivda',
}

export function StatusBadge({ status, publishedAt }: { status: ContentStatus; publishedAt?: string | null }) {
  const scheduled = status === 'published' && publishedAt && new Date(publishedAt) > new Date()
  if (scheduled) return <Badge variant="outline" title={formatDateTime(publishedAt)}>Rejalashtirilgan</Badge>
  return <Badge variant={status === 'published' ? 'default' : status === 'archived' ? 'muted' : 'secondary'}>{STATUS_LABEL[status]}</Badge>
}

export function ConflictBanner({ onReload }: { onReload: () => void }) {
  const [busy, setBusy] = React.useState(false)
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red bg-red/15 p-3 text-sm">
      <div>
        <p className="font-semibold">Bu yozuv o'zgargan, yangilang</p>
        <p className="text-xs text-muted-foreground">
          Boshqa oynada yoki boshqa foydalanuvchi tomonidan saqlangan. Sizning o‘zgarishlaringiz lokal qoralamaga yozib qo‘yildi.
        </p>
      </div>
      <Button
        variant="destructive"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await onReload()
          } finally {
            setBusy(false)
          }
        }}
      >
        <RefreshCw className={busy ? 'animate-spin' : ''} /> Yangilash
      </Button>
    </div>
  )
}

export function DraftBanner({ draft, serverUpdatedAt, onRestore, onDiscard }: { draft: StoredDraft<unknown>; serverUpdatedAt?: string | null; onRestore: () => void; onDiscard: () => void }) {
  const stale = serverUpdatedAt && draft.base_updated_at && draft.base_updated_at !== serverUpdatedAt
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/60 bg-primary/10 p-3 text-sm">
      <div className="flex items-start gap-2">
        <History className="mt-0.5 h-4 w-4 text-primary" />
        <div>
          <p className="font-semibold">Saqlanmagan qoralama topildi ({formatDateTime(draft.saved_at)})</p>
          {stale && <p className="text-xs text-muted-foreground">Diqqat: shundan keyin yozuv serverda o‘zgargan.</p>}
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onRestore}>
          Tiklash
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          O‘chirish
        </Button>
      </div>
    </div>
  )
}

interface ToolbarProps {
  backTo: string
  backLabel: string
  title: string
  status?: ContentStatus
  publishedAt?: string | null
  isNew: boolean
  saving: boolean
  publishing: boolean
  dirty: boolean
  onSave: () => void
  onPublish: (s: ContentStatus) => void
  onPreview: () => void
  scheduleAt?: string | null
}

export function EditorToolbar(p: ToolbarProps) {
  const scheduled = !!p.scheduleAt && new Date(p.scheduleAt) > new Date()
  return (
    <div className="sticky top-14 z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:top-0 md:-mx-6 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label={p.backLabel}>
          <Link to={p.backTo}>
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-bold">{p.title || 'Nomsiz'}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {p.status && <StatusBadge status={p.status} publishedAt={p.publishedAt} />}
            {p.dirty && <span>• saqlanmagan o‘zgarishlar</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!p.isNew && (
            <Button variant="outline" size="sm" onClick={p.onPreview} title="Qoralamani 1 soatlik havola bilan ko'rish">
              <ExternalLink /> Saytda ko‘rish
            </Button>
          )}
          <Button size="sm" onClick={p.onSave} disabled={p.saving} title="Ctrl+S">
            {p.saving ? <Loader2 className="animate-spin" /> : <Save />} Saqlash
          </Button>
          {!p.isNew && (
            <>
              {p.status !== 'draft' && (
                <Button variant="secondary" size="sm" disabled={p.publishing} onClick={() => p.onPublish('draft')}>
                  <FileText /> Draft
                </Button>
              )}
              <Button variant="secondary" size="sm" className="border border-primary/70" disabled={p.publishing} onClick={() => p.onPublish('published')}>
                {scheduled ? <CalendarClock /> : <Rocket />} {scheduled ? 'Rejalashtirish' : 'Nashr'}
              </Button>
              {p.status !== 'archived' && (
                <Button variant="ghost" size="sm" disabled={p.publishing} onClick={() => p.onPublish('archived')}>
                  <Archive /> Arxiv
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function FormErrorList({ errors }: { errors: string[] }) {
  if (!errors.length) return null
  return (
    <div role="alert" className="rounded-lg border border-red bg-red/15 p-3 text-sm">
      <ul className="list-disc pl-5">
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>
  )
}
