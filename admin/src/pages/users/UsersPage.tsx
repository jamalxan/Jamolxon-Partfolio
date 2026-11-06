import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, ShieldCheck, ShieldOff, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import type { z } from 'zod'
import { api, asItems, errorMessage, isApiError } from '@/lib/api'
import { applyServerErrors } from '@/lib/form-errors'
import { userCreateSchema } from '@/lib/schemas'
import type { ListResponse, Role, User } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Select } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Field } from '@/components/form/Field'
import { PageError, PageHeader, PageLoading } from '@/components/layout/PageState'

const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', editor: 'Editor' }
const USERS_KEY = ['users', 'list', { all: true }] as const

export default function UsersPage() {
  const { user: me } = useAuth()
  const qc = useQueryClient()
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const users = useQuery({ queryKey: USERS_KEY, queryFn: () => api<ListResponse<User> | User[]>('/users'), select: asItems })
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<{ role: Role; is_active: boolean; revoke_sessions: boolean }> }) =>
      api<User>(`/users/${id}`, { method: 'PATCH', body }),
    onSuccess: (_d, v) => {
      toast.success(v.body.revoke_sessions ? 'Sessiyalar bekor qilindi' : 'Saqlandi')
      void qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <div>
      <PageHeader
        title="Foydalanuvchilar"
        description="Owner hamma narsani boshqaradi; editor kontent yozadi va leadlarni ko'radi."
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus /> Taklif qilish
          </Button>
        }
      />
      {users.isPending ? (
        <PageLoading />
      ) : users.isError ? (
        <PageError error={users.error} />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Foydalanuvchi</TH>
              <TH>Rol</TH>
              <TH className="hidden md:table-cell">2FA</TH>
              <TH className="hidden md:table-cell">Oxirgi kirish</TH>
              <TH>Amallar</TH>
            </tr>
          </THead>
          <TBody>
            {users.data.map((u) => {
              const self = u.id === me?.id
              return (
                <TR key={u.id} className={u.is_active ? '' : 'opacity-60'}>
                  <TD>
                    <div className="font-semibold">
                      {u.name} {self && <span className="text-xs text-muted-foreground">(siz)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                    {!u.is_active && <Badge variant="muted">O‘chirilgan</Badge>}
                  </TD>
                  <TD>
                    <Select
                      className="h-8 w-28 text-xs"
                      aria-label={`${u.email} roli`}
                      value={u.role}
                      disabled={self || patch.isPending}
                      onChange={(e) => patch.mutate({ id: u.id, body: { role: e.target.value as Role } })}
                    >
                      <option value="owner">{ROLE_LABEL.owner}</option>
                      <option value="editor">{ROLE_LABEL.editor}</option>
                    </Select>
                  </TD>
                  <TD className="hidden md:table-cell">{u.totp_enabled ? <ShieldCheck className="h-4 w-4 text-primary" aria-label="Yoqilgan" /> : <ShieldOff className="h-4 w-4 text-muted-foreground" aria-label="Yoqilmagan" />}</TD>
                  <TD className="hidden whitespace-nowrap text-xs md:table-cell">{formatDateTime(u.last_login_at)}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={patch.isPending}
                        onClick={() => {
                          if (window.confirm(`${u.email}: barcha sessiyalar bekor qilinsinmi?`)) patch.mutate({ id: u.id, body: { revoke_sessions: true } })
                        }}
                      >
                        <LogOut /> Sessiyalar
                      </Button>
                      {!self && (
                        <Button
                          variant={u.is_active ? 'ghost' : 'secondary'}
                          size="sm"
                          disabled={patch.isPending}
                          onClick={() => {
                            if (!u.is_active || window.confirm(`${u.email} o'chirilsinmi (kira olmaydi)?`)) patch.mutate({ id: u.id, body: { is_active: !u.is_active } })
                          }}
                        >
                          {u.is_active ? 'O‘chirish' : 'Faollashtirish'}
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  )
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  type F = z.infer<typeof userCreateSchema>
  const form = useForm<F>({ resolver: zodResolver(userCreateSchema), defaultValues: { email: '', name: '', role: 'editor', password: '' } })
  const e = form.formState.errors
  const create = useMutation({
    mutationFn: (v: F) => api<User>('/users', { method: 'POST', body: v }),
    onSuccess: () => {
      toast.success("Foydalanuvchi qo'shildi. Birinchi kirishda 2FA ni yoqadi.")
      form.reset()
      onOpenChange(false)
      void qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => {
      if (isApiError(err) && (err.status === 422 || err.status === 409)) {
        const rest = applyServerErrors(err, form.setError, ['email', 'name', 'role', 'password'])
        if (rest.length || err.status === 409) toast.error(rest[0] ?? 'Bu email band')
      } else toast.error(errorMessage(err))
    },
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Foydalanuvchi taklif qilish</DialogTitle>
          <DialogDescription>Vaqtinchalik parolni xavfsiz kanal orqali yuboring. Birinchi kirishda 2FA majburiy.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" noValidate onSubmit={form.handleSubmit((v) => create.mutate(v))}>
          <Field label="Ism" htmlFor="u-name" error={e.name?.message}>
            <Input id="u-name" {...form.register('name')} />
          </Field>
          <Field label="Email" htmlFor="u-email" error={e.email?.message}>
            <Input id="u-email" type="email" {...form.register('email')} />
          </Field>
          <Field label="Rol" htmlFor="u-role">
            <Select id="u-role" {...form.register('role')}>
              <option value="editor">Editor</option>
              <option value="owner">Owner</option>
            </Select>
          </Field>
          <Field label="Vaqtinchalik parol" htmlFor="u-password" error={e.password?.message} hint="Kamida 12 belgi">
            <Input id="u-password" type="password" autoComplete="new-password" {...form.register('password')} />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={create.isPending}>
              Qo‘shish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
