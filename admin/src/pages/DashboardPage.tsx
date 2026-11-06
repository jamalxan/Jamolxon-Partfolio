import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, CheckCircle2, DatabaseBackup, Inbox, XCircle } from 'lucide-react'
import { api } from '@/lib/api'
import type { Dashboard } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import { useAuth } from '@/auth/AuthProvider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageError, PageHeader, PageLoading } from '@/components/layout/PageState'
import { CONTACT_LABEL } from './leads/leadMeta'

const ENTITY_PATH: Record<string, string> = { project: '/loyihalar', projects: '/loyihalar', post: '/blog', posts: '/blog', service: '/xizmatlar', services: '/xizmatlar' }

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-4xl font-black tabular-nums text-primary">{value}</p>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard'), refetchInterval: 60_000 })
  return (
    <div>
      <PageHeader title={`Salom, ${user?.name?.split(' ')[0] ?? ''}`} description="Bugungi holat" />
      {q.isPending ? (
        <PageLoading />
      ) : q.isError ? (
        <PageError error={q.error} />
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Bugun leadlar" value={q.data.leads.today} />
            <Stat label="Shu hafta" value={q.data.leads.week} />
            <Stat label="Shu oy" value={q.data.leads.month} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-primary" /> Yangi leadlar
                </CardTitle>
                <Link to="/leadlar" className="text-xs text-primary hover:underline">
                  Hammasi
                </Link>
              </CardHeader>
              <CardContent>
                {q.data.new_leads.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Yangi lead yo‘q</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {q.data.new_leads.map((l) => (
                      <li key={l.id}>
                        <Link to={`/leadlar?lead=${l.id}`} className="flex items-center gap-3 py-2 hover:text-primary">
                          <span className="text-xs tabular-nums text-muted-foreground">#{l.number}</span>
                          <span className="min-w-0 flex-1 truncate font-medium">{l.name}</span>
                          <span className="hidden text-xs text-muted-foreground sm:inline">
                            {CONTACT_LABEL[l.contact_type]} · {l.service}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatDateTime(l.created_at)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Tizim holati
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <DatabaseBackup className="h-4 w-4" /> Oxirgi backup: <strong>{formatDateTime(q.data.system.last_backup_at)}</strong>
                </div>
                <div className="flex items-center gap-2">
                  {q.data.system.errors_24h > 0 ? <AlertTriangle className="h-4 w-4 text-[#ff8a75]" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                  Xatolar (24 soat): <strong>{q.data.system.errors_24h}</strong>
                </div>
                <div className="flex items-center gap-2">
                  {q.data.system.worker_ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-[#ff8a75]" />}
                  Fon worker: <strong>{q.data.system.worker_ok ? 'ishlayapti' : "to'xtagan"}</strong>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Oxirgi nashrlar</CardTitle>
            </CardHeader>
            <CardContent>
              {q.data.recent_publications.length === 0 ? (
                <p className="text-sm text-muted-foreground">Hali nashr yo‘q</p>
              ) : (
                <ul className="divide-y divide-border">
                  {q.data.recent_publications.map((p) => (
                    <li key={`${p.entity}-${p.id}`} className="flex items-center gap-3 py-2 text-sm">
                      <Link to={`${ENTITY_PATH[p.entity] ?? '/'}/${p.id}`} className="min-w-0 flex-1 truncate hover:text-primary">
                        {p.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">{formatDateTime(p.published_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
