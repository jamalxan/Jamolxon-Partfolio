import * as React from 'react'

export const AUTOSAVE_INTERVAL_MS = 10_000
const PREFIX = 'jx-admin:draft:'

export interface StoredDraft<T> {
  values: T
  saved_at: string
  /** Qoralama qaysi server versiyasi ustida yozilgan. */
  base_updated_at: string | null
}

export function draftKey(res: string, id: string | undefined) {
  return `${PREFIX}${res}:${id ?? 'new'}`
}

export function readDraft<T>(key: string): StoredDraft<T> | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const d = JSON.parse(raw) as StoredDraft<T>
    return d && typeof d === 'object' && 'values' in d ? d : null
  } catch {
    return null
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* localStorage yopiq bo'lishi mumkin */
  }
}

export function writeDraft<T>(key: string, values: T, baseUpdatedAt: string | null) {
  try {
    const d: StoredDraft<T> = { values, saved_at: new Date().toISOString(), base_updated_at: baseUpdatedAt }
    localStorage.setItem(key, JSON.stringify(d))
  } catch {
    /* kvota to'lgan bo'lishi mumkin — jim o'tkazamiz */
  }
}

/**
 * Har 10 soniyada saqlanmagan o'zgarishlarni localStorage'ga yozadi.
 * Tokenlar emas, faqat forma kontenti saqlanadi.
 */
export function useAutosave<T>(opts: {
  key: string
  getValues: () => T
  isDirty: boolean
  baseUpdatedAt: string | null
  enabled?: boolean
  intervalMs?: number
}) {
  const { key, getValues, isDirty, baseUpdatedAt, enabled = true, intervalMs = AUTOSAVE_INTERVAL_MS } = opts
  const ref = React.useRef({ getValues, isDirty, baseUpdatedAt })
  ref.current = { getValues, isDirty, baseUpdatedAt }
  const [lastSavedAt, setLastSavedAt] = React.useState<Date | null>(null)

  React.useEffect(() => {
    if (!enabled) return
    const t = setInterval(() => {
      if (!ref.current.isDirty) return
      writeDraft(key, ref.current.getValues(), ref.current.baseUpdatedAt)
      setLastSavedAt(new Date())
    }, intervalMs)
    return () => clearInterval(t)
  }, [key, enabled, intervalMs])

  return { lastSavedAt }
}
