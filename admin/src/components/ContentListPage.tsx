import * as React from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { EmptyState, PageError, PageHeader, PageLoading } from '@/components/layout/PageState'
import { SortableList } from '@/components/SortableList'
import { StatusBadge } from '@/components/editor/EditorChrome'
import { qk, useList, useRemoveRecord, useReorder } from '@/lib/resources'
import { errorMessage } from '@/lib/api'
import type { ContentStatus, ListResponse } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'

interface Item {
  id: string
  title: string
  slug: string
  status: ContentStatus
  published_at: string | null
  updated_at: string
  is_featured?: boolean
}

interface Props {
  res: 'projects' | 'services' | 'posts'
  title: string
  description: string
  basePath: string
  newLabel: string
  meta?: (item: Item) => React.ReactNode
}

export function useDebouncedValue<T>(v: T, ms = 300): T {
  const [d, setD] = React.useState(v)
  React.useEffect(() => {
    const t = setTimeout(() => setD(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return d
}

export function ContentListPage({ res, title, description, basePath, newLabel, meta }: Props) {
  const [q, setQ] = React.useState('')
  const [status, setStatus] = React.useState<'' | ContentStatus>('')
  const dq = useDebouncedValue(q)
  const params = { q: dq, status, limit: 50 }
  const list = useList<Item>(res, params)
  const reorder = useReorder(res)
  const remove = useRemoveRecord(res)
  const qc = useQueryClient()
  const filtered = !!dq || !!status

  const onReorder = (ids: string[], items: Item[]) => {
    const key = qk.list(res, params)
    const prev = qc.getQueryData<ListResponse<Item>>(key)
    qc.setQueryData<ListResponse<Item>>(key, (old) => (old ? { ...old, items } : old))
    reorder.mutate(ids, {
      onSuccess: () => toast.success('Tartib saqlandi'),
      onError: (e) => {
        qc.setQueryData(key, prev)
        toast.error(errorMessage(e))
      },
    })
  }

  const onDelete = (item: Item) => {
    if (!window.confirm(`"${item.title}" o'chirilsinmi?`)) return
    remove.mutate(item.id, {
      onSuccess: () => toast.success("O'chirildi"),
      onError: (e) => toast.error(errorMessage(e)),
    })
  }

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button asChild>
            <Link to={`${basePath}/yangi`}>
              <Plus /> {newLabel}
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Qidirish..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidirish" />
        </div>
        <Select className="sm:w-48" value={status} onChange={(e) => setStatus(e.target.value as ContentStatus | '')} aria-label="Status bo'yicha filtr">
          <option value="">Barcha statuslar</option>
          <option value="draft">Qoralama</option>
          <option value="published">Nashr qilingan</option>
          <option value="archived">Arxivda</option>
        </Select>
      </div>
      {filtered && <p className="mb-2 text-xs text-muted-foreground">Qidiruv/filtr yoqilganda tartiblash o‘chiriladi.</p>}
      {list.isPending ? (
        <PageLoading />
      ) : list.isError ? (
        <PageError error={list.error} />
      ) : list.data.items.length === 0 ? (
        <EmptyState title="Hech narsa topilmadi" />
      ) : (
        <SortableList
          items={list.data.items}
          disabled={filtered}
          onReorder={onReorder}
          renderItem={(item) => (
            <div className="flex items-center gap-3">
              <Link to={`${basePath}/${item.id}`} className="min-w-0 flex-1 hover:underline">
                <div className="flex items-center gap-2">
                  {item.is_featured && <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" aria-label="Featured" />}
                  <span className="truncate font-semibold">{item.title}</span>
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  /{item.slug} · {meta ? meta(item) : `yangilangan ${formatDateTime(item.updated_at)}`}
                </div>
              </Link>
              <StatusBadge status={item.status} publishedAt={item.published_at} />
              <Button variant="ghost" size="icon" aria-label={`${item.title}ni o'chirish`} onClick={() => onDelete(item)}>
                <Trash2 />
              </Button>
            </div>
          )}
        />
      )}
      {list.data && list.data.total > list.data.items.length && (
        <p className="mt-3 text-xs text-muted-foreground">
          {list.data.total} tadan {list.data.items.length} tasi ko‘rsatildi. Aniqroq qidiring.
        </p>
      )}
    </div>
  )
}
