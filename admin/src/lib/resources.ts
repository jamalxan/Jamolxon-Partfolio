import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Query } from './api'
import type { ContentStatus, ListResponse, Media } from './types'

export type ResourceName = 'projects' | 'services' | 'posts' | 'categories' | 'tags' | 'offers' | 'steps'

export const qk = {
  list: (res: string, params?: Query) => [res, 'list', params ?? {}] as const,
  detail: (res: string, id: string) => [res, 'detail', id] as const,
  all: (res: string) => [res] as const,
}

export function useList<T>(res: ResourceName | 'media' | 'leads' | 'users' | 'redirects' | 'audit-logs', params: Query = {}, enabled = true) {
  return useQuery({
    queryKey: qk.list(res, params),
    queryFn: ({ signal }) => api<ListResponse<T>>(`/${res}`, { query: params, signal }),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useRecord<T>(res: ResourceName, id: string | undefined) {
  return useQuery({
    queryKey: qk.detail(res, id ?? 'new'),
    queryFn: ({ signal }) => api<T>(`/${res}/${id}`, { signal }),
    enabled: !!id,
    // Tahrirlash paytida fon yangilanishi formani buzmasin
    refetchOnWindowFocus: false,
  })
}

export function useSaveRecord<T extends { id: string }>(res: ResourceName) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Record<string, unknown> }) =>
      id ? api<T>(`/${res}/${id}`, { method: 'PATCH', body }) : api<T>(`/${res}`, { method: 'POST', body }),
    onSuccess: (data) => {
      if (data?.id) qc.setQueryData(qk.detail(res, data.id), data)
      void qc.invalidateQueries({ queryKey: [res, 'list'] })
    },
  })
}

export function useRemoveRecord(res: ResourceName | 'media' | 'redirects') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api<void>(`/${res}/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [res, 'list'] }),
  })
}

export function usePublish<T extends { id: string }>(res: 'projects' | 'services' | 'posts') {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, published_at }: { id: string; status: ContentStatus; published_at: string | null }) =>
      api<T | undefined>(`/${res}/${id}/publish`, { method: 'POST', body: { status, published_at } }),
    onSuccess: (data, vars) => {
      if (data && typeof data === 'object' && 'id' in data) qc.setQueryData(qk.detail(res, vars.id), data)
      void qc.invalidateQueries({ queryKey: qk.detail(res, vars.id) })
      void qc.invalidateQueries({ queryKey: [res, 'list'] })
    },
  })
}

export function useReorder(res: ResourceName) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => api<void>(`/${res}/reorder`, { method: 'POST', body: { ids } }),
    onSettled: () => qc.invalidateQueries({ queryKey: [res, 'list'] }),
  })
}

/** "Saytda ko'rish": preview tokenli havolani yangi oynada ochadi. */
export async function openPreview(res: 'projects' | 'services' | 'posts', id: string) {
  // Popup blokerdan qochish uchun oynani darhol ochamiz, havolani keyin beramiz.
  const w = window.open('about:blank', '_blank')
  try {
    const { url } = await api<{ url: string }>(`/${res}/${id}/preview`, { method: 'POST' })
    if (w) {
      w.opener = null
      w.location.href = url
    } else {
      window.open(url, '_blank', 'noopener')
    }
  } catch (e) {
    w?.close()
    throw e
  }
}

/** Media ro'yxati (picker va ko'rsatish uchun). */
export function useMediaList(q = '', limit = 50) {
  return useList<Media>('media', { q, limit })
}
