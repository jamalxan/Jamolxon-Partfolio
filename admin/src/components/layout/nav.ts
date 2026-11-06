import {
  BookOpen,
  Briefcase,
  FolderKanban,
  History,
  Image,
  Inbox,
  LayoutDashboard,
  ListOrdered,
  Settings,
  Sparkles,
  Tags,
  Users,
  Shapes,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/lib/types'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  roles: Role[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

const ALL: Role[] = ['owner', 'editor']
const OWNER: Role[] = ['owner']

export const NAV: NavGroup[] = [
  {
    label: 'Asosiy',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ALL },
      { to: '/leadlar', label: 'Leadlar', icon: Inbox, roles: ALL },
    ],
  },
  {
    label: 'Kontent',
    items: [
      { to: '/loyihalar', label: 'Loyihalar', icon: FolderKanban, roles: ALL },
      { to: '/xizmatlar', label: 'Xizmatlar', icon: Briefcase, roles: ALL },
      { to: '/blog', label: 'Blog', icon: BookOpen, roles: ALL },
      { to: '/kategoriyalar', label: 'Kategoriyalar', icon: Shapes, roles: ALL },
      { to: '/teglar', label: 'Teglar', icon: Tags, roles: ALL },
      { to: '/yechimlar', label: 'AI yechimlar', icon: Sparkles, roles: ALL },
      { to: '/jarayon', label: 'Jarayon', icon: ListOrdered, roles: ALL },
      { to: '/media', label: 'Media', icon: Image, roles: ALL },
    ],
  },
  {
    label: 'Tizim',
    items: [
      { to: '/sozlamalar', label: 'Sozlamalar', icon: Settings, roles: OWNER },
      { to: '/foydalanuvchilar', label: 'Foydalanuvchilar', icon: Users, roles: OWNER },
      { to: '/audit', label: 'Audit', icon: History, roles: OWNER },
    ],
  },
]

export function navFor(role: Role | undefined): NavGroup[] {
  if (!role) return []
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter((g) => g.items.length > 0)
}
