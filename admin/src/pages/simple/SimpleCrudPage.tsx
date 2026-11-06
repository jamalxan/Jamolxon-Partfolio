import * as React from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ZodType } from 'zod'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/form/Field'
import { PairListEditor } from '@/components/form/ListEditors'
import { EmptyState, PageError, PageHeader, PageLoading } from '@/components/layout/PageState'
import { SortableList } from '@/components/SortableList'
import { ConflictBanner } from '@/components/editor/EditorChrome'
import { errorMessage, isApiError } from '@/lib/api'
import { applyServerErrors } from '@/lib/form-errors'
import { qk, useList, useRemoveRecord, useReorder, useSaveRecord, type ResourceName } from '@/lib/resources'
import type { ListResponse } from '@/lib/types'

export type FieldDef =
  | { name: string; label: string; kind: 'text' | 'textarea' | 'color'; hint?: string }
  | { name: string; label: string; kind: 'select'; options: readonly string[] }
  | { name: string; label: string; kind: 'pairs'; keys: [string, string]; labels: [string, string]; addLabel: string }

type Values = Record<string, unknown>

export interface SimpleCrudConfig {
  res: Exclude<ResourceName, 'projects' | 'services' | 'posts'>
  title: string
  description: string
  singular: string
  fields: FieldDef[]
  schema: ZodType
  empty: Values
  toForm?: (r: Values) => Values
  fromForm?: (f: Values) => Values
  primary: (r: Values) => string
  secondary?: (r: Values) => string
}

type Row = Values & { id: string; updated_at?: string }

export function SimpleCrudPage({ config }: { config: SimpleCrudConfig }) {
  const list = useList<Row>(config.res, { limit: 50 })
  const reorder = useReorder(config.res)
  const remove = useRemoveRecord(config.res)
  const qc = useQueryClient()
  const [editing, setEditing] = React.useState<Row | 'new' | null>(null)

  const onReorder = (ids: string[], items: Row[]) => {
    const key = qk.list(config.res, { limit: 50 })
    const prev = qc.getQueryData<ListResponse<Row>>(key)
    qc.setQueryData<ListResponse<Row>>(key, (old) => (old ? { ...old, items } : old))
    reorder.mutate(ids, {
      onSuccess: () => toast.success('Tartib saqlandi'),
      onError: (e) => {
        qc.setQueryData(key, prev)
        toast.error(errorMessage(e))
      },
    })
  }

  return (
    <div>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus /> Qo‘shish
          </Button>
        }
      />
      {list.isPending ? (
        <PageLoading />
      ) : list.isError ? (
        <PageError error={list.error} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="Hali yozuv yo‘q" />
      ) : (
        <SortableList
          items={list.data.items}
          onReorder={onReorder}
          renderItem={(r) => (
            <div className="flex items-center gap-2">
              <button type="button" className="min-w-0 flex-1 text-left hover:underline" onClick={() => setEditing(r)}>
                <div className="truncate font-semibold">{config.primary(r)}</div>
                {config.secondary && <div className="truncate text-xs text-muted-foreground">{config.secondary(r)}</div>}
              </button>
              <Button variant="ghost" size="icon" aria-label={`${config.primary(r)}ni tahrirlash`} onClick={() => setEditing(r)}>
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${config.primary(r)}ni o'chirish`}
                onClick={() => {
                  if (!window.confirm(`"${config.primary(r)}" o'chirilsinmi?`)) return
                  remove.mutate(r.id, { onSuccess: () => toast.success("O'chirildi"), onError: (e) => toast.error(errorMessage(e)) })
                }}
              >
                <Trash2 />
              </Button>
            </div>
          )}
        />
      )}
      {editing && <EditDialog config={config} record={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function EditDialog({ config, record, onClose }: { config: SimpleCrudConfig; record: Row | null; onClose: () => void }) {
  const save = useSaveRecord<Row>(config.res)
  const qc = useQueryClient()
  const fromForm = config.fromForm ?? ((f: Values) => f)
  const initial = React.useMemo(() => {
    if (!record) return config.empty
    const f = config.toForm ? config.toForm(record) : record
    return Object.fromEntries(Object.keys(config.empty).map((k) => [k, f[k] ?? config.empty[k]]))
  }, [record, config])
  const [conflict, setConflict] = React.useState(false)
  const form = useForm<Values>({ resolver: zodResolver(config.schema) as unknown as Resolver<Values>, defaultValues: initial })
  const { register, control, handleSubmit, formState, setError } = form

  const onSubmit = handleSubmit(async (values) => {
    setConflict(false)
    const body = fromForm(values)
    if (record?.updated_at) body.updated_at = record.updated_at
    try {
      await save.mutateAsync({ id: record?.id, body })
      toast.success('Saqlandi')
      onClose()
    } catch (e) {
      if (isApiError(e) && e.status === 409) setConflict(true)
      else if (isApiError(e) && e.status === 422) {
        const rest = applyServerErrors(e, setError, Object.keys(config.empty))
        if (rest.length) toast.error(rest.join('\n'))
      } else toast.error(errorMessage(e))
    }
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{record ? `${config.singular}ni tahrirlash` : `Yangi ${config.singular.toLowerCase()}`}</DialogTitle>
        </DialogHeader>
        {conflict && (
          <ConflictBanner
            onReload={async () => {
              await qc.invalidateQueries({ queryKey: [config.res, 'list'] })
              onClose()
            }}
          />
        )}
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {config.fields.map((f) => {
            const err = (formState.errors[f.name]?.message as string | undefined) ?? undefined
            const id = `f-${f.name}`
            if (f.kind === 'pairs') {
              return (
                <Field key={f.name} label={f.label}>
                  <Controller
                    control={control}
                    name={f.name}
                    render={({ field }) => (
                      <PairListEditor
                        keys={f.keys}
                        labels={f.labels}
                        addLabel={f.addLabel}
                        value={(field.value as Record<string, string>[]) ?? []}
                        onChange={field.onChange}
                        error={formState.errors[f.name]}
                      />
                    )}
                  />
                </Field>
              )
            }
            return (
              <Field key={f.name} label={f.label} htmlFor={id} error={err} hint={'hint' in f ? f.hint : undefined}>
                {f.kind === 'textarea' ? (
                  <Textarea id={id} rows={3} aria-invalid={!!err} {...register(f.name)} />
                ) : f.kind === 'select' ? (
                  <Select id={id} {...register(f.name)}>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                ) : f.kind === 'color' ? (
                  <div className="flex gap-2">
                    <Input id={id} aria-invalid={!!err} placeholder="#CDF73D" {...register(f.name)} />
                    <Controller
                      control={control}
                      name={f.name}
                      render={({ field }) => (
                        <input
                          type="color"
                          aria-label={`${f.label} tanlash`}
                          className="h-10 w-12 cursor-pointer rounded border border-input bg-transparent"
                          value={/^#[0-9a-fA-F]{6}$/.test(String(field.value)) ? String(field.value) : '#cdf73d'}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      )}
                    />
                  </div>
                ) : (
                  <Input id={id} aria-invalid={!!err} {...register(f.name)} />
                )}
              </Field>
            )
          })}
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              Saqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
