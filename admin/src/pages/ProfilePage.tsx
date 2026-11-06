import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import type { z } from 'zod'
import { api, errorMessage, isApiError } from '@/lib/api'
import { applyServerErrors } from '@/lib/form-errors'
import { changePasswordSchema } from '@/lib/schemas'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, Section } from '@/components/form/Field'
import { PageHeader } from '@/components/layout/PageState'

type F = z.infer<typeof changePasswordSchema>

export default function ProfilePage() {
  const { user } = useAuth()
  const form = useForm<F>({ resolver: zodResolver(changePasswordSchema), defaultValues: { current_password: '', new_password: '', confirm: '' } })
  const e = form.formState.errors
  const submit = form.handleSubmit(async ({ current_password, new_password }) => {
    try {
      await api('/auth/password', { method: 'POST', body: { current_password, new_password } })
      toast.success("Parol o'zgartirildi")
      form.reset()
    } catch (err) {
      if (isApiError(err) && (err.status === 422 || err.status === 400 || err.status === 401)) {
        const rest = applyServerErrors(err, form.setError, ['current_password', 'new_password'])
        if (!err.fieldErrors.length) form.setError('current_password', { message: "Joriy parol noto'g'ri" })
        else if (rest.length) toast.error(rest.join('; '))
      } else toast.error(errorMessage(err))
    }
  })
  return (
    <div className="max-w-xl">
      <PageHeader title="Profil" description={`${user?.name ?? ''} · ${user?.email ?? ''} · ${user?.role === 'owner' ? 'Owner' : 'Editor'}`} />
      <form onSubmit={submit} noValidate>
        <Section title="Parolni o‘zgartirish" description="Kamida 12 belgi. Oshkor bo'lgan parollar (HIBP) qabul qilinmaydi.">
          <Field label="Joriy parol" htmlFor="current_password" error={e.current_password?.message}>
            <Input id="current_password" type="password" autoComplete="current-password" {...form.register('current_password')} />
          </Field>
          <Field label="Yangi parol" htmlFor="new_password" error={e.new_password?.message}>
            <Input id="new_password" type="password" autoComplete="new-password" {...form.register('new_password')} />
          </Field>
          <Field label="Yangi parol (takror)" htmlFor="confirm" error={e.confirm?.message}>
            <Input id="confirm" type="password" autoComplete="new-password" {...form.register('confirm')} />
          </Field>
          <div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Saqlash
            </Button>
          </div>
        </Section>
      </form>
    </div>
  )
}
