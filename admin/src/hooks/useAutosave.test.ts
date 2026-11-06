import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOSAVE_INTERVAL_MS, draftKey, readDraft, useAutosave } from './useAutosave'

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("har 10 soniyada o'zgargan formani localStorage'ga yozadi", () => {
    const key = draftKey('posts', 'b-1')
    let values = { title: 'A' }
    const { rerender } = renderHook((p: { dirty: boolean }) => useAutosave({ key, getValues: () => values, isDirty: p.dirty, baseUpdatedAt: '2026-01-01T00:00:00Z' }), {
      initialProps: { dirty: false },
    })
    act(() => vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS))
    expect(readDraft(key)).toBeNull() // o'zgarish yo'q — yozilmaydi

    values = { title: 'B' }
    rerender({ dirty: true })
    act(() => vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS - 1))
    expect(readDraft(key)).toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(readDraft<{ title: string }>(key)).toMatchObject({ values: { title: 'B' }, base_updated_at: '2026-01-01T00:00:00Z' })
  })
})
