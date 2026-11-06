import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Download, KanbanSquare, Search, Table2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, errorMessage } from '@/lib/api'
import { qk, useList } from '@/lib/resources'
import type { Lead, LeadStatus, ListResponse } from '@/lib/types'
import { cn, downloadBlob, formatDateTime } from '@/lib/utils'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { EmptyState, PageError, PageHeader, PageLoading } from '@/components/layout/PageState'
import { useDebouncedValue } from '@/components/ContentListPage'
import { CONTACT_LABEL, LEAD_STATUSES, LEAD_STATUS_COLOR, LEAD_STATUS_LABEL } from './leadMeta'
import { LeadDrawer } from './LeadDrawer'
import { useLeadStatusMutation } from './leadHooks'

export default function LeadsPage() {
  const { isOwner } = useAuth()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'jadval' ? 'table' : 'kanban'
  const openId = params.get('lead')
  const [q, setQ] = React.useState('')
  const dq = useDebouncedValue(q)
  const [exporting, setExporting] = React.useState(false)

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: k === 'lead' ? false : true })
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const res = await api<Response>('/leads/export.csv', { raw: true, query: { q: dq } })
      downloadBlob(await res.blob(), `leadlar-${new Date().toISOString().slice(0, 10)}.csv`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Leadlar"
        description={isOwner ? "Kartani boshqa ustunga torting yoki statusni tanlang" : "Ko'rish va izoh qoldirish"}
        actions={
          <>
            <div className="inline-flex rounded-full border border-border p-0.5" role="group" aria-label="Ko'rinish">
              <Button size="sm" variant={view === 'kanban' ? 'secondary' : 'ghost'} aria-pressed={view === 'kanban'} onClick={() => setParam('view', null)}>
                <KanbanSquare /> Kanban
              </Button>
              <Button size="sm" variant={view === 'table' ? 'secondary' : 'ghost'} aria-pressed={view === 'table'} onClick={() => setParam('view', 'jadval')}>
                <Table2 /> Jadval
              </Button>
            </div>
            {isOwner && (
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting}>
                <Download /> CSV eksport
              </Button>
            )}
          </>
        }
      />
      <div className="relative mb-4">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Ism, aloqa yoki xabar bo'yicha qidirish" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Leadlarni qidirish" />
      </div>
      {view === 'kanban' ? <Kanban q={dq} canMove={isOwner} onOpen={(id) => setParam('lead', id)} /> : <LeadsTable q={dq} onOpen={(id) => setParam('lead', id)} />}
      <LeadDrawer id={openId} onClose={() => setParam('lead', null)} />
    </div>
  )
}

function Kanban({ q, canMove, onOpen }: { q: string; canMove: boolean; onOpen: (id: string) => void }) {
  const qc = useQueryClient()
  const move = useLeadStatusMutation()
  const results = useQueries({
    queries: LEAD_STATUSES.map((status) => ({
      queryKey: qk.list('leads', { status, q, limit: 50 }),
      queryFn: ({ signal }: { signal: AbortSignal }) => api<ListResponse<Lead>>('/leads', { query: { status, q, limit: 50 }, signal }),
    })),
  })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))

  const moveLead = (lead: Lead, to: LeadStatus) => {
    if (lead.status === to) return
    const fromKey = qk.list('leads', { status: lead.status, q, limit: 50 })
    const toKey = qk.list('leads', { status: to, q, limit: 50 })
    const prevFrom = qc.getQueryData<ListResponse<Lead>>(fromKey)
    const prevTo = qc.getQueryData<ListResponse<Lead>>(toKey)
    // Optimistik: kartani darhol ko'chiramiz
    qc.setQueryData<ListResponse<Lead>>(fromKey, (old) => (old ? { ...old, items: old.items.filter((l) => l.id !== lead.id), total: old.total - 1 } : old))
    qc.setQueryData<ListResponse<Lead>>(toKey, (old) => (old ? { ...old, items: [{ ...lead, status: to }, ...old.items], total: old.total + 1 } : old))
    move.mutate(
      { id: lead.id, status: to },
      {
        onSuccess: () => toast.success(`#${lead.number} → ${LEAD_STATUS_LABEL[to]}`),
        onError: (e) => {
          qc.setQueryData(fromKey, prevFrom)
          qc.setQueryData(toKey, prevTo)
          toast.error(errorMessage(e))
        },
      },
    )
  }

  const onDragEnd = (e: DragEndEvent) => {
    const lead = e.active.data.current?.lead as Lead | undefined
    const to = e.over?.id as LeadStatus | undefined
    if (lead && to) moveLead(lead, to)
  }

  const firstError = results.find((r) => r.isError)?.error
  if (firstError) return <PageError error={firstError} />
  if (results.every((r) => r.isPending)) return <PageLoading />

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
        {LEAD_STATUSES.map((status, i) => {
          const data = results[i].data
          return (
            <Column key={status} status={status} count={data?.total ?? 0}>
              {(data?.items ?? []).map((lead) => (
                <LeadCard key={lead.id} lead={lead} canMove={canMove} onOpen={() => onOpen(lead.id)} onMove={(to) => moveLead(lead, to)} />
              ))}
            </Column>
          )
        })}
      </div>
    </DndContext>
  )
}

function Column({ status, count, children }: { status: LeadStatus; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section
      ref={setNodeRef}
      aria-label={`${LEAD_STATUS_LABEL[status]} ustuni`}
      data-testid={`column-${status}`}
      className={cn('flex w-[78vw] shrink-0 snap-start flex-col rounded-lg border border-border bg-maroon-2/40 sm:w-72', isOver && 'ring-2 ring-primary')}
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className={cn('h-2 w-2 rounded-full', LEAD_STATUS_COLOR[status])} />
        <h2 className="font-display text-xs font-bold uppercase tracking-wide">{LEAD_STATUS_LABEL[status]}</h2>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{count}</span>
      </header>
      <div className="grid min-h-24 content-start gap-2 p-2">{children}</div>
    </section>
  )
}

function LeadCard({ lead, canMove, onOpen, onMove }: { lead: Lead; canMove: boolean; onOpen: () => void; onMove: (s: LeadStatus) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id, data: { lead }, disabled: !canMove })
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn('rounded-md border border-border bg-card p-3 text-sm shadow-sm', canMove && 'cursor-grab touch-none', isDragging && 'z-10 opacity-80 ring-2 ring-primary')}
      data-testid={`lead-card-${lead.id}`}
      {...(canMove ? listeners : {})}
      {...(canMove ? attributes : {})}
    >
      <button type="button" className="w-full text-left" onClick={onOpen} onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{lead.name}</span>
          <span className="text-xs text-muted-foreground">#{lead.number}</span>
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {CONTACT_LABEL[lead.contact_type]}: {lead.contact_value}
        </div>
        <div className="mt-1 line-clamp-2 text-xs">{lead.message}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {lead.service} · {formatDateTime(lead.created_at)}
        </div>
      </button>
      {canMove && (
        <Select
          className="mt-2 h-8 text-xs"
          aria-label={`#${lead.number} statusi`}
          value={lead.status}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onChange={(e) => onMove(e.target.value as LeadStatus)}
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      )}
    </article>
  )
}

function LeadsTable({ q, onOpen }: { q: string; onOpen: (id: string) => void }) {
  const [status, setStatus] = React.useState<'' | LeadStatus>('')
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [page, setPage] = React.useState(1)
  React.useEffect(() => setPage(1), [q, status, from, to])
  const limit = 20
  const list = useList<Lead>('leads', { q, status, from, to, page, limit })
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / limit)) : 1
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus | '')} aria-label="Status bo'yicha filtr">
          <option value="">Barcha statuslar</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Sanadan" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Sanagacha" />
      </div>
      {list.isPending ? (
        <PageLoading />
      ) : list.isError ? (
        <PageError error={list.error} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="Lead topilmadi" />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>#</TH>
              <TH>Ism</TH>
              <TH>Aloqa</TH>
              <TH className="hidden md:table-cell">Xizmat</TH>
              <TH>Status</TH>
              <TH className="hidden md:table-cell">Sana</TH>
            </tr>
          </THead>
          <TBody>
            {list.data.items.map((l) => (
              <TR key={l.id} className="cursor-pointer" onClick={() => onOpen(l.id)}>
                <TD className="tabular-nums text-muted-foreground">{l.number}</TD>
                <TD>
                  <button type="button" className="font-semibold hover:underline" onClick={() => onOpen(l.id)}>
                    {l.name}
                  </button>
                </TD>
                <TD className="max-w-[10rem] truncate">{l.contact_value}</TD>
                <TD className="hidden md:table-cell">{l.service}</TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className={cn('h-2 w-2 rounded-full', LEAD_STATUS_COLOR[l.status])} />
                    {LEAD_STATUS_LABEL[l.status]}
                  </span>
                </TD>
                <TD className="hidden whitespace-nowrap text-xs md:table-cell">{formatDateTime(l.created_at)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
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
