import * as React from 'react'
import { useForm, type DefaultValues, type FieldValues, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { ZodType } from 'zod'
import { errorMessage, isApiError } from '@/lib/api'
import { applyServerErrors } from '@/lib/form-errors'
import { openPreview, usePublish, useRecord, useSaveRecord } from '@/lib/resources'
import type { ContentStatus, Publishable } from '@/lib/types'
import { clearDraft, draftKey, readDraft, useAutosave, writeDraft, type StoredDraft } from '@/hooks/useAutosave'
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard'
import { useHotkey } from '@/hooks/useHotkey'

type Res = 'projects' | 'services' | 'posts'

interface Options<R, F extends FieldValues> {
  res: Res
  id: string | undefined
  basePath: string
  schema: ZodType<F, F>
  empty: F
  toForm: (r: R) => F
  fromForm: (f: F) => Record<string, unknown>
}

export function useEntityEditor<R extends Publishable & { id: string; title: string }, F extends FieldValues>(opts: Options<R, F>) {
  const { res, id, basePath, schema, empty, toForm, fromForm } = opts
  const isNew = !id
  const navigate = useNavigate()
  const recordQ = useRecord<R>(res, id)
  const record = recordQ.data
  const save = useSaveRecord<R>(res)
  const publishM = usePublish<R>(res)
  const [conflict, setConflict] = React.useState(false)
  const [formErrors, setFormErrors] = React.useState<string[]>([])

  const form = useForm<F>({
    resolver: zodResolver(schema) as unknown as Resolver<F>,
    defaultValues: empty as DefaultValues<F>,
    mode: 'onSubmit',
  })
  const { reset, getValues, setError, formState } = form

  // Server ma'lumoti kelganda formani to'ldiramiz
  const loadedFor = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (record && loadedFor.current !== record.updated_at) {
      loadedFor.current = record.updated_at
      reset(toForm(record))
    }
  }, [record, reset, toForm])

  const key = draftKey(res, id)
  const [draft, setDraft] = React.useState<StoredDraft<F> | null>(() => readDraft<F>(key))
  React.useEffect(() => setDraft(readDraft<F>(key)), [key])

  const ready = isNew || !!record
  const getAll = React.useCallback((): F => getValues(), [getValues])
  useAutosave<F>({ key, getValues: getAll, isDirty: formState.isDirty, baseUpdatedAt: record?.updated_at ?? null, enabled: ready })
  const guard = useUnsavedGuard(formState.isDirty)

  const restoreDraft = React.useCallback(() => {
    if (!draft) return
    // keepDefaultValues: forma "o'zgargan" holatda qoladi, shunda saqlash/ogohlantirish ishlaydi
    reset(draft.values, { keepDefaultValues: true })
    setDraft(null)
    toast.success('Qoralama tiklandi')
  }, [draft, reset])

  const discardDraft = React.useCallback(() => {
    clearDraft(key)
    setDraft(null)
  }, [key])

  const doSave = React.useCallback(
    async (values: F): Promise<R | null> => {
      setFormErrors([])
      setConflict(false)
      const body = fromForm(values)
      if (!isNew && record) body.updated_at = record.updated_at
      try {
        const saved = await save.mutateAsync({ id, body })
        clearDraft(key)
        setDraft(null)
        loadedFor.current = saved.updated_at
        reset(toForm(saved))
        toast.success('Saqlandi')
        if (isNew) {
          clearDraft(draftKey(res, saved.id))
          guard.bypass()
          navigate(`${basePath}/${saved.id}`, { replace: true })
        }
        return saved
      } catch (e) {
        if (isApiError(e) && e.status === 409) {
          // Yo'qolmasin: joriy holatni lokal qoralamaga yozib qo'yamiz
          writeDraft(key, values, record?.updated_at ?? null)
          setConflict(true)
        } else if (isApiError(e) && e.status === 422) {
          const rest = applyServerErrors(e, setError, Object.keys(empty))
          setFormErrors(rest)
          toast.error("Formada xatolar bor")
        } else {
          toast.error(errorMessage(e))
        }
        return null
      }
    },
    [fromForm, isNew, record, save, id, key, reset, toForm, res, guard, navigate, basePath, setError, empty],
  )

  const submit = form.handleSubmit(doSave, () => toast.error('Formada xatolar bor'))
  useHotkey('mod+s', () => void submit(), ready)

  const reload = React.useCallback(async () => {
    const fresh = await recordQ.refetch()
    if (fresh.data) {
      loadedFor.current = fresh.data.updated_at
      reset(toForm(fresh.data))
    }
    setConflict(false)
    setDraft(readDraft<F>(key))
  }, [recordQ, reset, toForm, key])

  const publish = React.useCallback(
    async (status: ContentStatus, publishedAt: string | null = null) => {
      if (!id) return
      // O'zgarishlar bo'lsa avval saqlaymiz (bitta bosish)
      if (formState.isDirty) {
        let ok = false
        await form.handleSubmit(async (v) => {
          ok = !!(await doSave(v))
        })()
        if (!ok) return
      }
      try {
        await publishM.mutateAsync({ id, status, published_at: publishedAt })
        const msg: Record<ContentStatus, string> = {
          published: publishedAt && new Date(publishedAt) > new Date() ? 'Nashr rejalashtirildi' : 'Nashr qilindi',
          draft: 'Qoralamaga qaytarildi',
          archived: 'Arxivlandi',
        }
        toast.success(msg[status])
      } catch (e) {
        if (isApiError(e) && e.status === 409) setConflict(true)
        else toast.error(errorMessage(e))
      }
    },
    [id, formState.isDirty, form, doSave, publishM],
  )

  const preview = React.useCallback(async () => {
    if (!id) return
    try {
      await openPreview(res, id)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }, [id, res])

  return {
    form,
    record,
    isNew,
    loading: !isNew && recordQ.isPending,
    loadError: recordQ.error,
    saving: save.isPending || formState.isSubmitting,
    publishing: publishM.isPending,
    submit,
    publish,
    preview,
    conflict,
    reload,
    draft,
    restoreDraft,
    discardDraft,
    formErrors,
  }
}

export type EntityEditor = ReturnType<typeof useEntityEditor>
