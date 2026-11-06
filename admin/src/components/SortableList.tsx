import * as React from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props<T extends { id: string }> {
  items: T[]
  onReorder: (ids: string[], items: T[]) => void
  renderItem: (item: T) => React.ReactNode
  /** Qidiruv/filtr yoqilganda tartiblash o'chiriladi (to'liq ro'yxat bo'lmagani uchun). */
  disabled?: boolean
}

function Row({ id, disabled, children }: { id: string; disabled?: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-2 sm:px-3', isDragging && 'relative z-10 shadow-xl ring-2 ring-primary')}
    >
      <button
        type="button"
        className={cn('touch-none rounded p-1 text-muted-foreground', disabled ? 'cursor-not-allowed opacity-30' : 'cursor-grab hover:text-foreground')}
        aria-label="Tartibni o'zgartirish uchun torting"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  )
}

export function SortableList<T extends { id: string }>({ items, onReorder, renderItem, disabled }: Props<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.id === active.id)
    const to = items.findIndex((i) => i.id === over.id)
    const next = arrayMove(items, from, to)
    onReorder(
      next.map((i) => i.id),
      next,
    )
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="grid gap-2">
          {items.map((item) => (
            <Row key={item.id} id={item.id} disabled={disabled}>
              {renderItem(item)}
            </Row>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
