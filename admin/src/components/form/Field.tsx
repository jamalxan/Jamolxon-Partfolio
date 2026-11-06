import * as React from 'react'
import { Label } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-xs font-medium text-[#ff8a75]">
      {message}
    </p>
  )
}

interface FieldProps {
  label: string
  htmlFor?: string
  error?: string
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError message={error} id={htmlFor ? `${htmlFor}-error` : undefined} />
    </div>
  )
}

export function Section({ title, description, children, actions }: { title: string; description?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-primary">{title}</h2>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  )
}

/** Belgi hisoblagichi (SEO maydonlari uchun). */
export function CharCount({ value, max }: { value: string; max: number }) {
  const n = value.length
  return <span className={cn('text-xs tabular-nums', n > max ? 'text-[#ff8a75]' : 'text-muted-foreground')}>{n}/{max}</span>
}
