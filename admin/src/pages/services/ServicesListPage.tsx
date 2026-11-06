import { ContentListPage } from '@/components/ContentListPage'

export default function ServicesListPage() {
  return (
    <ContentListPage
      res="services"
      title="Xizmatlar"
      description="Xizmat sahifalari: /xizmatlar/<slug>"
      basePath="/xizmatlar"
      newLabel="Yangi xizmat"
    />
  )
}
