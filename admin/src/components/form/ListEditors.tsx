import * as React from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import type { FieldError as RHFError, FieldErrors, Merge } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { FieldError } from './Field'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyErr = Merge<RHFError, any> | FieldErrors | undefined

/** RHF xatosidan i-element xabarini olish (massiv yoki obyekt ko'rinishida bo'lishi mumkin). */
export function itemError(err: AnyErr, ...path: (string | number)[]): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = err
  for (const p of path) {
    if (cur == null) return undefined
    cur = cur[p]
  }
  if (typeof cur?.message === 'string') return cur.message
  if (path.length === 0 && typeof cur?.root?.message === 'string') return cur.root.message
  return undefined
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr
  const next = arr.slice()
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}

function RowControls({ i, len, onMove, onRemove, label }: { i: number; len: number; onMove: (to: number) => void; onRemove: () => void; label: string }) {
  return (
    <div className="flex shrink-0 gap-0.5">
      <Button variant="ghost" size="icon" aria-label={`${label} ${i + 1}: yuqoriga`} disabled={i === 0} onClick={() => onMove(i - 1)}>
        <ArrowUp />
      </Button>
      <Button variant="ghost" size="icon" aria-label={`${label} ${i + 1}: pastga`} disabled={i === len - 1} onClick={() => onMove(i + 1)}>
        <ArrowDown />
      </Button>
      <Button variant="ghost" size="icon" aria-label={`${label} ${i + 1}: o'chirish`} onClick={onRemove}>
        <Trash2 />
      </Button>
    </div>
  )
}

interface StringListProps {
  value: string[]
  onChange: (v: string[]) => void
  label: string
  addLabel?: string
  multiline?: boolean
  error?: AnyErr
  placeholder?: string
}

export function StringListEditor({ value, onChange, label, addLabel = "Qo'shish", multiline, error, placeholder }: StringListProps) {
  const set = (i: number, v: string) => onChange(value.map((x, j) => (j === i ? v : x)))
  return (
    <div className="grid gap-2">
      {value.map((item, i) => (
        <div key={i} className="grid gap-1">
          <div className="flex items-start gap-2">
            {multiline ? (
              <Textarea aria-label={`${label} ${i + 1}`} value={item} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} rows={2} />
            ) : (
              <Input aria-label={`${label} ${i + 1}`} value={item} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} />
            )}
            <RowControls i={i} len={value.length} label={label} onMove={(to) => onChange(move(value, i, to))} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
          </div>
          <FieldError message={itemError(error, i)} />
        </div>
      ))}
      <FieldError message={itemError(error)} />
      <div>
        <Button variant="outline" size="sm" onClick={() => onChange([...value, ''])}>
          <Plus /> {addLabel}
        </Button>
      </div>
    </div>
  )
}

export interface SectionValue {
  h: string
  p: string[]
}

export function SectionsEditor({ value, onChange, error }: { value: SectionValue[]; onChange: (v: SectionValue[]) => void; error?: AnyErr }) {
  const setAt = (i: number, s: SectionValue) => onChange(value.map((x, j) => (j === i ? s : x)))
  return (
    <div className="grid gap-3">
      {value.map((s, i) => (
        <div key={i} className="grid gap-2 rounded-md border border-border bg-maroon/40 p-3">
          <div className="flex items-start gap-2">
            <div className="grid flex-1 gap-1">
              <Input aria-label={`Bo'lim ${i + 1} sarlavhasi`} placeholder="Sarlavha (masalan: Muammo)" value={s.h} onChange={(e) => setAt(i, { ...s, h: e.target.value })} />
              <FieldError message={itemError(error, i, 'h')} />
            </div>
            <RowControls i={i} len={value.length} label="Bo'lim" onMove={(to) => onChange(move(value, i, to))} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
          </div>
          <div className="pl-2 sm:pl-4">
            <StringListEditor
              label={`Bo'lim ${i + 1} paragraf`}
              addLabel="Paragraf"
              multiline
              value={s.p}
              onChange={(p) => setAt(i, { ...s, p })}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              error={(error as any)?.[i]?.p}
            />
          </div>
        </div>
      ))}
      <div>
        <Button variant="outline" size="sm" onClick={() => onChange([...value, { h: '', p: [''] }])}>
          <Plus /> Bo‘lim qo‘shish
        </Button>
      </div>
    </div>
  )
}

export function PairListEditor<K1 extends string, K2 extends string>({
  value,
  onChange,
  keys,
  labels,
  addLabel,
  multilineSecond,
  error,
}: {
  value: Record<K1 | K2, string>[]
  onChange: (v: Record<K1 | K2, string>[]) => void
  keys: [K1, K2]
  labels: [string, string]
  addLabel: string
  multilineSecond?: boolean
  error?: AnyErr
}) {
  const [k1, k2] = keys
  const setAt = (i: number, k: K1 | K2, v: string) => onChange(value.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  return (
    <div className="grid gap-2">
      {value.map((row, i) => (
        <div key={i} className="flex items-start gap-2 rounded-md border border-border bg-maroon/40 p-2">
          <div className="grid flex-1 gap-2 sm:grid-cols-2">
            <div className="grid gap-1">
              <Input aria-label={`${labels[0]} ${i + 1}`} placeholder={labels[0]} value={row[k1]} onChange={(e) => setAt(i, k1, e.target.value)} />
              <FieldError message={itemError(error, i, k1)} />
            </div>
            <div className="grid gap-1">
              {multilineSecond ? (
                <Textarea aria-label={`${labels[1]} ${i + 1}`} placeholder={labels[1]} value={row[k2]} rows={2} onChange={(e) => setAt(i, k2, e.target.value)} />
              ) : (
                <Input aria-label={`${labels[1]} ${i + 1}`} placeholder={labels[1]} value={row[k2]} onChange={(e) => setAt(i, k2, e.target.value)} />
              )}
              <FieldError message={itemError(error, i, k2)} />
            </div>
          </div>
          <RowControls i={i} len={value.length} label={labels[0]} onMove={(to) => onChange(move(value, i, to))} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div>
        <Button variant="outline" size="sm" onClick={() => onChange([...value, { [k1]: '', [k2]: '' } as Record<K1 | K2, string>])}>
          <Plus /> {addLabel}
        </Button>
      </div>
    </div>
  )
}

/** Teglar: Enter yoki vergul bilan qo'shiladi. */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  label,
  placeholder = "Yozing va Enter bosing",
  id,
}: {
  value: string[]
  onChange: (v: string[]) => void
  suggestions?: string[]
  label: string
  placeholder?: string
  id?: string
}) {
  const [draft, setDraft] = React.useState('')
  const listId = React.useId()
  const add = (raw: string) => {
    const t = raw.trim()
    if (!t || value.some((v) => v.toLowerCase() === t.toLowerCase())) return
    onChange([...value, t])
  }
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-maroon-card px-2 py-1.5">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-maroon-2 px-2.5 py-0.5 text-xs">
          {t}
          <button type="button" aria-label={`${t} ni olib tashlash`} onClick={() => onChange(value.filter((x) => x !== t))}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        aria-label={label}
        list={suggestions.length ? listId : undefined}
        className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add(draft)
            setDraft('')
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => {
          if (draft) {
            add(draft)
            setDraft('')
          }
        }}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.filter((s) => !value.includes(s)).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  )
}
