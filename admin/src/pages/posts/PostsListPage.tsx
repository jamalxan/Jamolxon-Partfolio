import { ContentListPage } from '@/components/ContentListPage'
import { formatDateTime } from '@/lib/utils'

export default function PostsListPage() {
  return (
    <ContentListPage
      res="posts"
      title="Blog"
      description="Maqolalar. Kelajakdagi sana bilan nashr qilingan post o'sha vaqtda chiqadi."
      basePath="/blog"
      newLabel="Yangi post"
      meta={(p) => (p.published_at ? `nashr: ${formatDateTime(p.published_at)}` : `yangilangan ${formatDateTime(p.updated_at)}`)}
    />
  )
}
