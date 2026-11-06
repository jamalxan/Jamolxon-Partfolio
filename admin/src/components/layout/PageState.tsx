import * as React from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api'

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function PageLoading() {
  return (
    <div className="grid gap-3" role="status" aria-label="Yuklanmoqda">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
    </div>
  )
}

export function PageError({ error }: { error: unknown }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-lg border border-red bg-red/15 p-4 text-sm">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      {errorMessage(error)}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-12 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <p className="font-display text-sm font-bold">{title}</p>
      {children}
    </div>
  )
}
