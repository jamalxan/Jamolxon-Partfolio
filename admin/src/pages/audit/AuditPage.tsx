import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { api, asItems } from '@/lib/api'
import type { AuditLog, ListResponse, User } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { EmptyState, PageError, PageHeader, PageLoading } from '@/components/layout/PageState'

const ENTITIES = ['projects', 'services', 'posts', 'categories', 'tags', 'offers', 'steps', 'media', 'leads', 'settings', 'users', 'redirects']

type DiffRow = { field: string; before: unknown; after: unknown }

/** Diff turli ko'rinishda bo'lishi mumkin: {field: [old, new]}, {before:{}, after:{}} yoki {field: {old, new}}. */
export function normalizeDiff(diff: unknown): DiffRow[] | null {
  if (!diff || typeof diff !== 'object' || Array.isArray(diff)) return null
  const d = diff as Record<string, unknown>
  if ('before' in d || 'after' in d) {
    const b = (d.before ?? {}) as Record<string, unknown>
    const a = (d.after ?? {}) as Record<string, unknown>
    const keys = Array.from(new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})]))
    return keys.map((field) => ({ field, before: b?.[field], after: a?.[field] }))
  }
  return Object.entries(d).map(([field, v]) => {
    if (Array.isArray(v) && v.length === 2) return { field, before: v[0], after: v[1] }
    if (v && typeof v === 'object' && ('old' in v || 'new' in v)) {
      const o = v as { old?: unknown; new?: unknown }
      return { field, before: o.old, after: o.new }
    }
    return { field, before: undefined, after: v }
  })
}

function show(v: unknown): string {
  if (v === undefined) return '—'
  if (typeof v === 'string') return v
  return JSON.stringify(v, null, 2)
}

export function DiffViewer({ diff }: { diff: unknown }) {
  const rows = normalizeDiff(diff)
  if (!rows) return <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-xs">{show(diff)}</pre>
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">O‘zgarish yo‘q</p>
  return (
    <div className="grid gap-1 text-xs" data-testid="diff-viewer">
      {rows.map((r) => (
        <div key={r.field} className="grid gap-1 rounded border border-border p-2 md:grid-cols-[140px_1fr_1fr]">
          <div className="font-mono font-semibold">{r.field}</div>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-red/20 p-1.5 line-through decoration-red/60">{show(r.before)}</pre>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-emerald-500/15 p-1.5">{show(r.after)}</pre>
        </div>
      ))}
    </div>
  )
}

export default function AuditPage() {
  const [entity, setEntity] = React.useState('')
  const [actor, setActor] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState<string | null>(null)
  React.useEffect(() => setPage(1), [entity, actor])
  const users = useQuery({ queryKey: ['users', 'list', { all: true }], queryFn: () => api<ListResponse<User> | User[]>('/users'), select: asItems })
  const logs = useQuery({
    queryKey: ['audit-logs', 'list', { entity, actor, page }],
    queryFn: ({ signal }) => api<ListResponse<AuditLog>>('/audit-logs', { query: { entity, actor_id: actor, page }, signal }),
  })
  const pages = logs.data ? Math.max(1, Math.ceil(logs.data.total / (logs.data.limit || 12))) : 1
  return (
    <div>
      <PageHeader title="Audit jurnali" description="Barcha admin harakatlari. O'chirib bo'lmaydi, 1 yil saqlanadi." />
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <Select value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Obyekt bo'yicha filtr">
          <option value="">Barcha obyektlar</option>
          {ENTITIES.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </Select>
        <Select value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Foydalanuvchi bo'yicha filtr">
          <option value="">Barcha foydalanuvchilar</option>
          {(users.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.email}
            </option>
          ))}
        </Select>
      </div>
      {logs.isPending ? (
        <PageLoading />
      ) : logs.isError ? (
        <PageError error={logs.error} />
      ) : logs.data.items.length === 0 ? (
        <EmptyState title="Yozuv yo‘q" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH className="w-8" />
              <TH>Vaqt</TH>
              <TH>Kim</TH>
              <TH>Amal</TH>
              <TH className="hidden md:table-cell">Obyekt</TH>
              <TH className="hidden lg:table-cell">IP</TH>
            </tr>
          </THead>
          <TBody>
            {logs.data.items.map((l) => (
              <React.Fragment key={l.id}>
                <TR className="cursor-pointer" onClick={() => setOpen(open === l.id ? null : l.id)}>
                  <TD>
                    <button type="button" aria-expanded={open === l.id} aria-label="Diff ko'rish">
                      {open === l.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </TD>
                  <TD className="whitespace-nowrap text-xs">{formatDateTime(l.created_at)}</TD>
                  <TD className="text-xs">{l.actor?.email ?? 'tizim'}</TD>
                  <TD className="font-mono text-xs">{l.action}</TD>
                  <TD className="hidden text-xs md:table-cell">
                    {l.entity}
                    {l.entity_id ? <span className="text-muted-foreground"> · {l.entity_id.slice(0, 8)}</span> : null}
                  </TD>
                  <TD className="hidden font-mono text-xs lg:table-cell">{l.ip ?? '—'}</TD>
                </TR>
                {open === l.id && (
                  <tr>
                    <td colSpan={6} className="bg-maroon/40 p-3">
                      <DiffViewer diff={l.diff} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </TBody>
        </Table>
      )}
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Oldingi
          </Button>
          <span className="tabular-nums">
            {page} / {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Keyingi
          </Button>
        </div>
      )}
    </div>
  )
}
