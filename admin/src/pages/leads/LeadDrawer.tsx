import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, MessageSquare, Phone, PhoneCall, Send, StickyNote, ArrowRightLeft } from 'lucide-react'
import { toast } from 'sonner'
import { api, asItems, errorMessage } from '@/lib/api'
import type { Lead, LeadEvent, LeadStatus, ListResponse, User } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import { useAuth } from '@/auth/AuthProvider'
import { Dialog, DialogDescription, DialogTitle, SheetContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label, Select, Textarea } from '@/components/ui/input'
import { PageError, PageLoading } from '@/components/layout/PageState'
import { BUDGET_LABEL, CONTACT_LABEL, DEADLINE_LABEL, LEAD_STATUSES, LEAD_STATUS_LABEL, mailUrl, phoneUrl, telegramUrl } from './leadMeta'
import { useLeadStatusMutation } from './leadHooks'

function eventText(ev: LeadEvent): string {
  const p = ev.payload ?? {}
  if (ev.kind === 'status_change') {
    const from = LEAD_STATUS_LABEL[p.from as LeadStatus] ?? String(p.from ?? '')
    const to = LEAD_STATUS_LABEL[p.to as LeadStatus] ?? String(p.to ?? '')
    return from ? `${from} → ${to}` : `Status: ${to}`
  }
  return typeof p.text === 'string' ? p.text : JSON.stringify(p)
}

const EVENT_ICON: Record<string, React.ReactNode> = {
  status_change: <ArrowRightLeft className="h-3.5 w-3.5" />,
  note: <StickyNote className="h-3.5 w-3.5" />,
  call: <PhoneCall className="h-3.5 w-3.5" />,
}
const EVENT_LABEL: Record<string, string> = { status_change: 'Status', note: 'Izoh', call: "Qo'ng'iroq" }

export function LeadDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent aria-describedby={undefined}>{id && <LeadDetail id={id} />}</SheetContent>
    </Dialog>
  )
}

function LeadDetail({ id }: { id: string }) {
  const { isOwner } = useAuth()
  const qc = useQueryClient()
  const lead = useQuery({ queryKey: ['lead', id], queryFn: ({ signal }) => api<Lead>(`/leads/${id}`, { signal }) })
  const users = useQuery({
    queryKey: qk_users,
    queryFn: () => api<ListResponse<User> | User[]>('/users'),
    enabled: isOwner,
    select: (d) => asItems(d),
  })
  const statusM = useLeadStatusMutation()
  const assignM = useMutation({
    mutationFn: (assigned_to: string | null) => api<Lead>(`/leads/${id}`, { method: 'PATCH', body: { assigned_to } }),
    onSuccess: () => {
      toast.success('Saqlandi')
      void qc.invalidateQueries({ queryKey: ['lead', id] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const [kind, setKind] = React.useState<'note' | 'call'>('note')
  const [text, setText] = React.useState('')
  const addEvent = useMutation({
    mutationFn: () => api<LeadEvent>(`/leads/${id}/events`, { method: 'POST', body: { kind, payload: { text: text.trim() } } }),
    onSuccess: () => {
      setText('')
      toast.success(kind === 'call' ? "Qo'ng'iroq yozildi" : "Izoh qo'shildi")
      void qc.invalidateQueries({ queryKey: ['lead', id] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (lead.isPending) return <div className="p-6"><PageLoading /></div>
  if (lead.isError) return <div className="p-6"><PageError error={lead.error} /></div>
  const l = lead.data
  const tg = telegramUrl(l)
  const tel = phoneUrl(l)
  const mail = mailUrl(l)
  const events = [...(l.events ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <div className="grid gap-5 p-5 sm:p-6">
      <div className="pr-8">
        <p className="text-xs text-muted-foreground">Lead #{l.number} · {formatDateTime(l.created_at)}</p>
        <DialogTitle className="text-xl">{l.name}</DialogTitle>
        <DialogDescription>
          {CONTACT_LABEL[l.contact_type]}: <span className="text-foreground">{l.contact_value}</span>
        </DialogDescription>
      </div>

      <div className="flex flex-wrap gap-2">
        {tg && (
          <Button asChild size="sm">
            <a href={tg} target="_blank" rel="noopener noreferrer">
              <Send /> Telegram'da yozish
            </a>
          </Button>
        )}
        {tel && (
          <Button asChild size="sm" variant="secondary">
            <a href={tel}>
              <Phone /> Qo‘ng‘iroq
            </a>
          </Button>
        )}
        {mail && (
          <Button asChild size="sm" variant="secondary">
            <a href={mail}>
              <Mail /> Email yozish
            </a>
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border p-3 text-sm">
        <dt className="text-muted-foreground">Xizmat</dt>
        <dd>{l.service}</dd>
        <dt className="text-muted-foreground">Byudjet</dt>
        <dd>{l.budget_range ? BUDGET_LABEL[l.budget_range] ?? l.budget_range : '—'}</dd>
        <dt className="text-muted-foreground">Muddat</dt>
        <dd>{l.deadline ? DEADLINE_LABEL[l.deadline] ?? l.deadline : '—'}</dd>
        <dt className="text-muted-foreground">Manba</dt>
        <dd className="break-all">{l.source_page ?? '—'}</dd>
        {l.utm && Object.keys(l.utm).length > 0 && (
          <>
            <dt className="text-muted-foreground">UTM</dt>
            <dd className="break-all text-xs">{Object.entries(l.utm).map(([k, v]) => `${k}=${v}`).join(' · ')}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Spam bali</dt>
        <dd>{l.spam_score}</dd>
      </dl>

      <div>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Xabar</h3>
        <p className="whitespace-pre-wrap rounded-lg bg-maroon-2/60 p-3 text-sm">{l.message}</p>
      </div>

      {isOwner ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="lead-status">Status</Label>
            <Select
              id="lead-status"
              value={l.status}
              disabled={statusM.isPending}
              onChange={(e) =>
                statusM.mutate(
                  { id: l.id, status: e.target.value as LeadStatus },
                  { onSuccess: () => toast.success('Status o‘zgardi'), onError: (err) => toast.error(errorMessage(err)) },
                )
              }
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lead-assignee">Mas'ul</Label>
            <Select id="lead-assignee" value={l.assigned_to ?? ''} disabled={assignM.isPending} onChange={(e) => assignM.mutate(e.target.value || null)}>
              <option value="">— tayinlanmagan —</option>
              {(users.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : (
        <p className="text-sm">
          Status: <strong>{LEAD_STATUS_LABEL[l.status]}</strong>
        </p>
      )}

      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim().length < 1) return
          addEvent.mutate()
        }}
      >
        <div className="flex gap-1" role="radiogroup" aria-label="Yozuv turi">
          <Button size="sm" variant={kind === 'note' ? 'secondary' : 'ghost'} aria-pressed={kind === 'note'} onClick={() => setKind('note')}>
            <MessageSquare /> Izoh
          </Button>
          <Button size="sm" variant={kind === 'call' ? 'secondary' : 'ghost'} aria-pressed={kind === 'call'} onClick={() => setKind('call')}>
            <PhoneCall /> Qo‘ng‘iroq
          </Button>
        </div>
        <Textarea
          aria-label={kind === 'call' ? "Qo'ng'iroq natijasi" : 'Izoh matni'}
          placeholder={kind === 'call' ? "Qo'ng'iroq natijasi..." : 'Izoh...'}
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
        />
        <div>
          <Button type="submit" size="sm" disabled={!text.trim() || addEvent.isPending}>
            Qo‘shish
          </Button>
        </div>
      </form>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Tarix</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Hali hech narsa yo‘q</p>
        ) : (
          <ol className="relative grid gap-3 border-l border-border pl-4" aria-label="Lead tarixi">
            {events.map((ev) => (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[1.4rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-maroon-2 text-primary">{EVENT_ICON[ev.kind] ?? <StickyNote className="h-3.5 w-3.5" />}</span>
                <div className="text-xs text-muted-foreground">
                  {EVENT_LABEL[ev.kind] ?? ev.kind} · {ev.actor?.email ?? 'tizim'} · {formatDateTime(ev.created_at)}
                </div>
                <p className="whitespace-pre-wrap text-sm">{eventText(ev)}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

const qk_users = ['users', 'list', { all: true }] as const
