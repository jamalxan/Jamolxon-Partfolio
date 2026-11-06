import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useQueries } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Briefcase, FolderKanban, Inbox, Loader2, Search } from 'lucide-react'
import { api } from '@/lib/api'
import type { ListResponse } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/components/ContentListPage'

interface Hit {
  key: string
  group: string
  title: string
  sub: string
  to: string
  icon: React.ReactNode
}

const SOURCES = [
  { res: 'projects', group: 'Loyihalar', base: '/loyihalar', icon: <FolderKanban className="h-4 w-4" /> },
  { res: 'posts', group: 'Blog', base: '/blog', icon: <BookOpen className="h-4 w-4" /> },
  { res: 'services', group: 'Xizmatlar', base: '/xizmatlar', icon: <Briefcase className="h-4 w-4" /> },
  { res: 'leads', group: 'Leadlar', base: '/leadlar', icon: <Inbox className="h-4 w-4" /> },
] as const

type Row = { id: string; title?: string; slug?: string; name?: string; number?: number; contact_value?: string }

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = React.useState('')
  const dq = useDebouncedValue(q.trim(), 200)
  const [active, setActive] = React.useState(0)
  const navigate = useNavigate()
  const results = useQueries({
    queries: SOURCES.map((s) => ({
      queryKey: [s.res, 'list', { q: dq, limit: 5 }],
      queryFn: ({ signal }: { signal: AbortSignal }) => api<ListResponse<Row>>(`/${s.res}`, { query: { q: dq, limit: 5 }, signal }),
      enabled: open && dq.length >= 2,
      staleTime: 30_000,
    })),
  })
  const loading = results.some((r) => r.isFetching)

  const hits: Hit[] = React.useMemo(() => {
    if (dq.length < 2) return []
    return SOURCES.flatMap((s, i) =>
      (results[i].data?.items ?? []).map((r) => ({
        key: `${s.res}-${r.id}`,
        group: s.group,
        title: s.res === 'leads' ? `#${r.number} ${r.name ?? ''}` : r.title ?? '',
        sub: s.res === 'leads' ? r.contact_value ?? '' : `/${r.slug ?? ''}`,
        to: s.res === 'leads' ? `/leadlar?lead=${r.id}` : `${s.base}/${r.id}`,
        icon: s.icon,
      })),
    )
  }, [results, dq])

  React.useEffect(() => setActive(0), [dq])
  React.useEffect(() => {
    if (!open) setQ('')
  }, [open])

  const go = (h: Hit | undefined) => {
    if (!h) return
    onOpenChange(false)
    navigate(h.to)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-popover shadow-2xl"
        >
          <DialogPrimitive.Title className="sr-only">Tezkor qidiruv</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-border px-3">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Search className="h-4 w-4 text-muted-foreground" />}
            <input
              autoFocus
              role="combobox"
              aria-expanded={hits.length > 0}
              aria-controls="cmdk-list"
              aria-label="Loyiha, post, xizmat yoki lead qidirish"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Loyiha, post, xizmat yoki lead..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActive((a) => Math.min(a + 1, hits.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActive((a) => Math.max(a - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  go(hits[active])
                }
              }}
            />
            <kbd className="rounded border border-border px-1.5 text-[10px] text-muted-foreground">Esc</kbd>
          </div>
          <ul id="cmdk-list" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
            {dq.length < 2 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Kamida 2 harf yozing</li>}
            {dq.length >= 2 && !loading && hits.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Hech narsa topilmadi</li>}
            {hits.map((h, i) => (
              <li
                key={h.key}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(h)}
                className={cn('flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm', i === active && 'bg-accent')}
              >
                <span className="text-primary">{h.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{h.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{h.sub}</span>
                </span>
                <span className="text-[11px] text-muted-foreground">{h.group}</span>
              </li>
            ))}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
