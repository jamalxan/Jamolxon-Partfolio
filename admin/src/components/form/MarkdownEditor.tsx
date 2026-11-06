import * as React from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { Bold, Heading2, Italic, Link2, List, Quote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Markdown → xavfsiz HTML (faqat preview uchun; sayt uchun server nh3 bilan tozalaydi). */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false, gfm: true, breaks: false }) as string
  return DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'iframe', 'form'], FORBID_ATTR: ['style'] })
}

interface Props {
  id?: string
  value: string
  onChange: (v: string) => void
  invalid?: boolean
}

export function MarkdownEditor({ id, value, onChange, invalid }: Props) {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  const [tab, setTab] = React.useState<'edit' | 'preview'>('edit')
  const deferred = React.useDeferredValue(value)
  const html = React.useMemo(() => renderMarkdown(deferred), [deferred])

  const wrap = (before: string, after = before, placeholder = 'matn') => {
    const el = ref.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el
    const sel = value.slice(s, e) || placeholder
    const next = value.slice(0, s) + before + sel + after + value.slice(e)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(s + before.length, s + before.length + sel.length)
    })
  }
  const linePrefix = (prefix: string) => {
    const el = ref.current
    if (!el) return
    const s = el.selectionStart
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart))
  }

  return (
    <div className="overflow-hidden rounded-md border border-input">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-maroon-2/60 px-2 py-1">
        <Button variant="ghost" size="icon" aria-label="Qalin" onClick={() => wrap('**')}>
          <Bold />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Kursiv" onClick={() => wrap('_')}>
          <Italic />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Sarlavha" onClick={() => linePrefix('## ')}>
          <Heading2 />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Ro'yxat" onClick={() => linePrefix('- ')}>
          <List />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Iqtibos" onClick={() => linePrefix('> ')}>
          <Quote />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Havola" onClick={() => wrap('[', '](https://)', 'havola matni')}>
          <Link2 />
        </Button>
        <div className="ml-auto flex gap-1 lg:hidden" role="tablist">
          <Button size="sm" variant={tab === 'edit' ? 'secondary' : 'ghost'} role="tab" aria-selected={tab === 'edit'} onClick={() => setTab('edit')}>
            Yozish
          </Button>
          <Button size="sm" variant={tab === 'preview' ? 'secondary' : 'ghost'} role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')}>
            Ko‘rish
          </Button>
        </div>
      </div>
      <div className="grid lg:grid-cols-2">
        <Textarea
          id={id}
          ref={ref}
          value={value}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
          className={cn('min-h-[420px] rounded-none border-0 font-mono text-[13px] focus-visible:ring-0', tab === 'preview' && 'hidden lg:block')}
          placeholder="## Sarlavha&#10;&#10;Matn Markdown formatida..."
        />
        <div
          data-testid="md-preview"
          aria-label="Jonli ko'rinish"
          className={cn('prose-jx min-h-[420px] overflow-y-auto border-border bg-maroon/50 p-4 text-sm lg:border-l', tab === 'edit' && 'hidden lg:block')}
          dangerouslySetInnerHTML={{ __html: html || '<p class="opacity-60">Ko‘rinish shu yerda chiqadi</p>' }}
        />
      </div>
    </div>
  )
}
