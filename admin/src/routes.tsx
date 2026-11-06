import * as React from 'react'
import { Link, type RouteObject } from 'react-router-dom'
import { RequireAuth, RequireOwner, FullScreenLoader } from '@/auth/guards'
import { AppLayout } from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import { Button } from '@/components/ui/button'

const ProjectsListPage = React.lazy(() => import('@/pages/projects/ProjectsListPage'))
const ProjectEditPage = React.lazy(() => import('@/pages/projects/ProjectEditPage'))
const ServicesListPage = React.lazy(() => import('@/pages/services/ServicesListPage'))
const ServiceEditPage = React.lazy(() => import('@/pages/services/ServiceEditPage'))
const PostsListPage = React.lazy(() => import('@/pages/posts/PostsListPage'))
const PostEditPage = React.lazy(() => import('@/pages/posts/PostEditPage'))
const LeadsPage = React.lazy(() => import('@/pages/leads/LeadsPage'))
const MediaPage = React.lazy(() => import('@/pages/media/MediaPage'))
const SettingsPage = React.lazy(() => import('@/pages/settings/SettingsPage'))
const UsersPage = React.lazy(() => import('@/pages/users/UsersPage'))
const AuditPage = React.lazy(() => import('@/pages/audit/AuditPage'))
const ProfilePage = React.lazy(() => import('@/pages/ProfilePage'))
const CategoriesPage = React.lazy(() => import('@/pages/simple/configs').then((m) => ({ default: m.CategoriesPage })))
const TagsPage = React.lazy(() => import('@/pages/simple/configs').then((m) => ({ default: m.TagsPage })))
const OffersPage = React.lazy(() => import('@/pages/simple/configs').then((m) => ({ default: m.OffersPage })))
const StepsPage = React.lazy(() => import('@/pages/simple/configs').then((m) => ({ default: m.StepsPage })))

const s = (el: React.ReactNode) => <React.Suspense fallback={<FullScreenLoader />}>{el}</React.Suspense>

function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="font-display text-3xl font-black">404</h1>
      <p className="text-muted-foreground">Sahifa topilmadi.</p>
      <Button asChild>
        <Link to="/">Bosh sahifa</Link>
      </Button>
    </div>
  )
}

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'loyihalar', element: s(<ProjectsListPage />) },
          { path: 'loyihalar/yangi', element: s(<ProjectEditPage key="new" />) },
          { path: 'loyihalar/:id', element: s(<ProjectEditPage />) },
          { path: 'xizmatlar', element: s(<ServicesListPage />) },
          { path: 'xizmatlar/yangi', element: s(<ServiceEditPage key="new" />) },
          { path: 'xizmatlar/:id', element: s(<ServiceEditPage />) },
          { path: 'blog', element: s(<PostsListPage />) },
          { path: 'blog/yangi', element: s(<PostEditPage key="new" />) },
          { path: 'blog/:id', element: s(<PostEditPage />) },
          { path: 'kategoriyalar', element: s(<CategoriesPage />) },
          { path: 'teglar', element: s(<TagsPage />) },
          { path: 'yechimlar', element: s(<OffersPage />) },
          { path: 'jarayon', element: s(<StepsPage />) },
          { path: 'leadlar', element: s(<LeadsPage />) },
          { path: 'media', element: s(<MediaPage />) },
          { path: 'profil', element: s(<ProfilePage />) },
          {
            element: <RequireOwner />,
            children: [
              { path: 'sozlamalar', element: s(<SettingsPage />) },
              { path: 'foydalanuvchilar', element: s(<UsersPage />) },
              { path: 'audit', element: s(<AuditPage />) },
            ],
          },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]
