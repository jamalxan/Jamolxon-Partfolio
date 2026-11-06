import { ContentListPage } from '@/components/ContentListPage'

export default function ProjectsListPage() {
  return (
    <ContentListPage
      res="projects"
      title="Loyihalar"
      description="Tartibni o'zgartirish uchun qatorni torting. Saytda shu tartibda chiqadi."
      basePath="/loyihalar"
      newLabel="Yangi loyiha"
    />
  )
}
