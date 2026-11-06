import * as React from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, LogOut, Menu, Search, UserCircle2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle, SheetContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { navFor } from './nav'
import { CommandPalette } from './CommandPalette'
import { useHotkey } from '@/hooks/useHotkey'

const COLLAPSE_KEY = 'jx-admin:sidebar-collapsed'

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex h-14 items-center gap-2 px-4 font-display text-lg font-black tracking-tight">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">J</span>
      {!collapsed && (
        <span>
          jamolxon<span className="text-primary">.uz</span>
        </span>
      )}
    </div>
  )
}

function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { user } = useAuth()
  const groups = navFor(user?.role)
  return (
    <nav aria-label="Asosiy menyu" className="flex-1 overflow-y-auto px-2 py-2">
      {groups.map((g) => (
        <div key={g.label} className="mb-4">
          {!collapsed && <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</p>}
          <ul className="grid gap-0.5">
            {g.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-full px-3 py-2 text-sm font-medium transition-colors',
                      collapsed && 'justify-center px-0',
                      isActive ? 'bg-primary text-primary-foreground' : 'text-cream/85 hover:bg-accent',
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                  {collapsed && <span className="sr-only">{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function UserBox({ collapsed }: { collapsed?: boolean }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className={cn('flex items-center gap-2 border-t border-border p-3', collapsed && 'flex-col')}>
      <NavLink to="/profil" className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 hover:bg-accent" title="Profil">
        <UserCircle2 className="h-6 w-6 shrink-0 text-primary" />
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{user?.name}</span>
            <span className="block text-xs text-muted-foreground">{user?.role === 'owner' ? 'Owner' : 'Editor'}</span>
          </span>
        )}
      </NavLink>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Chiqish"
        onClick={async () => {
          await logout()
          navigate('/login', { replace: true })
        }}
      >
        <LogOut />
      </Button>
    </div>
  )
}

export function AppLayout() {
  const [collapsed, setCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const location = useLocation()
  useHotkey('mod+k', () => setPaletteOpen((o) => !o))
  React.useEffect(() => setMobileOpen(false), [location.pathname])

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        /* ignore */
      }
      return !c
    })

  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Kontentga o‘tish
      </a>
      {/* Desktop sidebar */}
      <aside className={cn('sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-maroon-card/60 transition-[width] md:flex', collapsed ? 'w-[68px]' : 'w-60')}>
        <Brand collapsed={collapsed} />
        <div className="px-2">
          <Button variant="outline" className={cn('w-full justify-start text-muted-foreground', collapsed && 'justify-center px-0')} onClick={() => setPaletteOpen(true)} aria-label="Tezkor qidiruv (Ctrl+K)">
            <Search />
            {!collapsed && (
              <>
                <span className="font-sans font-normal">Qidirish</span>
                <kbd className="ml-auto rounded border border-border px-1.5 font-sans text-[10px]">Ctrl K</kbd>
              </>
            )}
          </Button>
        </div>
        <NavList collapsed={collapsed} />
        <Button variant="ghost" size="sm" className="mx-2 mb-1 justify-center" onClick={toggle} aria-label={collapsed ? 'Menyuni kengaytirish' : "Menyuni yig'ish"}>
          {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
        </Button>
        <UserBox collapsed={collapsed} />
      </aside>

      {/* Mobil topbar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur md:hidden">
        <Button variant="ghost" size="icon" aria-label="Menyuni ochish" onClick={() => setMobileOpen(true)}>
          <Menu />
        </Button>
        <span className="font-display font-black">
          jamolxon<span className="text-primary">.uz</span>
        </span>
        <Button variant="ghost" size="icon" className="ml-auto" aria-label="Tezkor qidiruv" onClick={() => setPaletteOpen(true)}>
          <Search />
        </Button>
      </header>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" aria-describedby={undefined} className="bg-maroon-card">
          <DialogTitle className="sr-only">Menyu</DialogTitle>
          <Brand />
          <NavList onNavigate={() => setMobileOpen(false)} />
          <UserBox />
        </SheetContent>
      </Dialog>

      <main id="main" className="min-w-0 flex-1 px-4 pb-16 pt-4 md:px-6 md:pt-6">
        <Outlet />
      </main>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}
