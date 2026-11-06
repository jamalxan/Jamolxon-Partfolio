import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Hammer, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { api, asItems, errorMessage, isApiError } from '@/lib/api'
import { applyServerErrors } from '@/lib/form-errors'
import { redirectSchema, seoDescription, seoTitle } from '@/lib/schemas'
import type { ListResponse, Redirect, Settings } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Field, Section } from '@/components/form/Field'
import { PairListEditor } from '@/components/form/ListEditors'
import { PageError, PageHeader, PageLoading } from '@/components/layout/PageState'
import { useHotkey } from '@/hooks/useHotkey'
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard'

const optUrl = z.string().trim().refine((v) => v === '' || /^https?:\/\/\S+$/.test(v), "To'g'ri havola kiriting (https://...)")

const settingsFormSchema = z.object({
  contact: z.object({
    tg: z.string().trim().max(64),
    tgUrl: optUrl,
    gh: z.string().trim().max(120),
    ghUrl: optUrl,
    ig: z.string().trim().max(64),
    igUrl: optUrl,
    email: z.string().trim().refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Email noto'g'ri"),
    phone: z.string().trim().refine((v) => v === '' || /^\+\d[\d\s]{7,18}$/.test(v), 'Telefon +998 90 123 45 67 ko‘rinishida'),
    studio: z.string().trim().max(120),
    studioUrl: optUrl,
  }),
  social: z.array(z.object({ name: z.string().trim().min(1, 'Nomi majburiy'), url: optUrl })),
  seo: z.object({ title: seoTitle, description: seoDescription, og_image: optUrl }),
  telegram: z.object({ chat_id: z.string().trim().refine((v) => v === '' || /^-?\d{3,20}$/.test(v), 'Chat ID faqat raqam (guruh uchun - bilan)') }),
})
type SettingsForm = z.infer<typeof settingsFormSchema>

const str = (v: unknown) => (typeof v === 'string' ? v : '')

function toForm(s: Settings): SettingsForm {
  const c = s.contact ?? {}
  const mailParts = Array.isArray(c.mailParts) ? (c.mailParts as string[]) : []
  const telParts = Array.isArray(c.telParts) ? (c.telParts as string[]) : []
  return {
    contact: {
      tg: str(c.tg),
      tgUrl: str(c.tgUrl),
      gh: str(c.gh),
      ghUrl: str(c.ghUrl),
      ig: str(c.ig),
      igUrl: str(c.igUrl),
      email: mailParts.length ? mailParts.join('@') : str(c.email),
      phone: telParts.length ? telParts.join(' ') : str(c.phone),
      studio: str(c.studio),
      studioUrl: str(c.studioUrl),
    },
    social: Object.entries(s.social ?? {}).map(([name, url]) => ({ name, url: str(url) })),
    seo: { title: s.seo?.title ?? '', description: s.seo?.description ?? '', og_image: s.seo?.og_image ?? '' },
    telegram: { chat_id: s.telegram?.chat_id ?? '' },
  }
}

function fromForm(f: SettingsForm, original: Settings): Settings {
  const { email, phone, ...rest } = f.contact
  // Saytdagi CONTACT formati: email va telefon spam botlardan yashirish uchun bo'laklarga ajratiladi
  const contact: Record<string, unknown> = { ...original.contact, ...rest }
  const at = email.indexOf('@')
  contact.mailParts = email ? [email.slice(0, at), email.slice(at + 1)] : []
  contact.telParts = phone ? phone.split(/\s+/).filter(Boolean) : []
  return {
    contact,
    social: Object.fromEntries(f.social.map((s) => [s.name, s.url])),
    seo: { title: f.seo.title, description: f.seo.description, og_image: f.seo.og_image || null },
    telegram: { chat_id: f.telegram.chat_id },
  }
}

export default function SettingsPage() {
  const q = useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/settings'), refetchOnWindowFocus: false })
  return (
    <div className="grid gap-6">
      <PageHeader title="Sozlamalar" description="Sayt bo'ylab umumiy ma'lumotlar. Faqat owner." actions={<RebuildButton />} />
      {q.isPending ? <PageLoading /> : q.isError ? <PageError error={q.error} /> : <SettingsEditor settings={q.data} />}
      <Redirects />
    </div>
  )
}

function RebuildButton() {
  const m = useMutation({
    mutationFn: () => api<{ job_id: string }>('/site/rebuild', { method: 'POST' }),
    onSuccess: (r) => toast.success(`Sayt qayta yig'ilmoqda (vazifa: ${r?.job_id ?? '—'})`),
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Button variant="outline" onClick={() => m.mutate()} disabled={m.isPending}>
      {m.isPending ? <Loader2 className="animate-spin" /> : <Hammer />} Saytni qayta yig‘ish
    </Button>
  )
}

function SettingsEditor({ settings }: { settings: Settings }) {
  const qc = useQueryClient()
  const form = useForm<SettingsForm>({ resolver: zodResolver(settingsFormSchema), defaultValues: toForm(settings) })
  const { register, control, formState, handleSubmit, reset, setError } = form
  const e = formState.errors
  useUnsavedGuard(formState.isDirty)

  const save = useMutation({
    mutationFn: (v: SettingsForm) => api<Settings>('/settings', { method: 'PUT', body: fromForm(v, settings) }),
    onSuccess: (data, v) => {
      const next = data ?? fromForm(v, settings)
      qc.setQueryData(['settings'], next)
      reset(toForm(next))
      toast.success('Sozlamalar saqlandi')
    },
    onError: (err) => {
      if (isApiError(err) && err.status === 422) {
        const rest = applyServerErrors(err, setError, ['contact', 'social', 'seo', 'telegram'])
        toast.error(rest.length ? rest.join('; ') : 'Formada xatolar bor')
      } else toast.error(errorMessage(err))
    },
  })
  const submit = handleSubmit((v) => save.mutate(v))
  useHotkey('mod+s', () => void submit())

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Kontaktlar">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="c-email" error={e.contact?.email?.message}>
              <Input id="c-email" type="email" {...register('contact.email')} />
            </Field>
            <Field label="Telefon" htmlFor="c-phone" error={e.contact?.phone?.message} hint="+998 93 160 67 06">
              <Input id="c-phone" {...register('contact.phone')} />
            </Field>
            <Field label="Telegram" htmlFor="c-tg" error={e.contact?.tg?.message}>
              <Input id="c-tg" {...register('contact.tg')} />
            </Field>
            <Field label="Telegram havola" htmlFor="c-tgUrl" error={e.contact?.tgUrl?.message}>
              <Input id="c-tgUrl" {...register('contact.tgUrl')} />
            </Field>
            <Field label="Instagram" htmlFor="c-ig" error={e.contact?.ig?.message}>
              <Input id="c-ig" {...register('contact.ig')} />
            </Field>
            <Field label="Instagram havola" htmlFor="c-igUrl" error={e.contact?.igUrl?.message}>
              <Input id="c-igUrl" {...register('contact.igUrl')} />
            </Field>
            <Field label="GitHub" htmlFor="c-gh" error={e.contact?.gh?.message}>
              <Input id="c-gh" {...register('contact.gh')} />
            </Field>
            <Field label="GitHub havola" htmlFor="c-ghUrl" error={e.contact?.ghUrl?.message}>
              <Input id="c-ghUrl" {...register('contact.ghUrl')} />
            </Field>
            <Field label="Studiya" htmlFor="c-studio" error={e.contact?.studio?.message}>
              <Input id="c-studio" {...register('contact.studio')} />
            </Field>
            <Field label="Studiya havola" htmlFor="c-studioUrl" error={e.contact?.studioUrl?.message}>
              <Input id="c-studioUrl" {...register('contact.studioUrl')} />
            </Field>
          </div>
        </Section>
        <div className="grid content-start gap-4">
          <Section title="SEO (default)">
            <Field label="Sarlavha" htmlFor="seo-title" error={e.seo?.title?.message}>
              <Input id="seo-title" {...register('seo.title')} />
            </Field>
            <Field label="Tavsif" htmlFor="seo-desc" error={e.seo?.description?.message}>
              <Textarea id="seo-desc" rows={3} {...register('seo.description')} />
            </Field>
            <Field label="OG rasm (URL, 1200×630)" htmlFor="seo-og" error={e.seo?.og_image?.message} hint="Media bo'limidan URL nusxalab qo'ying">
              <Input id="seo-og" placeholder="https://media.jamolxon.uz/..." {...register('seo.og_image')} />
            </Field>
          </Section>
          <Section title="Telegram">
            <Field label="Chat ID (bildirishnomalar)" htmlFor="tg-chat" error={e.telegram?.chat_id?.message}>
              <Input id="tg-chat" inputMode="numeric" {...register('telegram.chat_id')} />
            </Field>
          </Section>
          <Section title="Ijtimoiy tarmoqlar">
            <Controller
              control={control}
              name="social"
              render={({ field }) => <PairListEditor keys={['name', 'url']} labels={['Nomi', 'URL']} addLabel="Tarmoq qo'shish" value={field.value} onChange={field.onChange} error={e.social} />}
            />
          </Section>
        </div>
      </div>
      <div>
        <Button type="submit" disabled={save.isPending} title="Ctrl+S">
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Saqlash
        </Button>
      </div>
    </form>
  )
}

function Redirects() {
  const qc = useQueryClient()
  const list = useQuery({ queryKey: ['redirects', 'list'], queryFn: () => api<ListResponse<Redirect> | Redirect[]>('/redirects'), select: asItems })
  const form = useForm<z.infer<typeof redirectSchema>>({ resolver: zodResolver(redirectSchema), defaultValues: { from_path: '', to_path: '', code: 301 } })
  const add = useMutation({
    mutationFn: (v: z.infer<typeof redirectSchema>) => api<Redirect>('/redirects', { method: 'POST', body: v }),
    onSuccess: () => {
      toast.success("Redirect qo'shildi")
      form.reset()
      void qc.invalidateQueries({ queryKey: ['redirects', 'list'] })
    },
    onError: (err) => {
      if (isApiError(err) && (err.status === 422 || err.status === 409)) {
        const rest = applyServerErrors(err, form.setError, ['from_path', 'to_path', 'code'])
        toast.error(rest[0] ?? errorMessage(err))
      } else toast.error(errorMessage(err))
    },
  })
  const del = useMutation({
    mutationFn: (id: string) => api<void>(`/redirects/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['redirects', 'list'] }),
    onError: (err) => toast.error(errorMessage(err)),
  })
  const e = form.formState.errors
  return (
    <Section title="Redirectlar" description="Slug o'zgarganda backend avtomatik 301 qo'shadi. Bu yerda qo'lda qo'shish mumkin.">
      <form
        className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_auto] sm:items-start"
        noValidate
        onSubmit={form.handleSubmit((v) => add.mutate(v))}
      >
        <div className="grid gap-1">
          <Input aria-label="Qayerdan" placeholder="/eski-yol" aria-invalid={!!e.from_path} {...form.register('from_path')} />
          {e.from_path && <span className="text-xs text-[#ff8a75]">{e.from_path.message}</span>}
        </div>
        <div className="grid gap-1">
          <Input aria-label="Qayerga" placeholder="/yangi-yol" aria-invalid={!!e.to_path} {...form.register('to_path')} />
          {e.to_path && <span className="text-xs text-[#ff8a75]">{e.to_path.message}</span>}
        </div>
        <Select aria-label="Kod" {...form.register('code', { valueAsNumber: true })}>
          <option value={301}>301</option>
          <option value={302}>302</option>
        </Select>
        <Button type="submit" disabled={add.isPending}>
          <Plus /> Qo‘shish
        </Button>
      </form>
      {list.isPending ? (
        <PageLoading />
      ) : list.isError ? (
        <PageError error={list.error} />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Qayerdan</TH>
              <TH>Qayerga</TH>
              <TH>Kod</TH>
              <TH className="w-12" />
            </tr>
          </THead>
          <TBody>
            {list.data.length === 0 && (
              <TR>
                <TD colSpan={4} className="text-center text-muted-foreground">
                  Redirect yo‘q
                </TD>
              </TR>
            )}
            {list.data.map((r) => (
              <TR key={r.id}>
                <TD className="break-all font-mono text-xs">{r.from_path}</TD>
                <TD className="break-all font-mono text-xs">{r.to_path}</TD>
                <TD>{r.code}</TD>
                <TD>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${r.from_path} redirectini o'chirish`}
                    onClick={() => {
                      if (window.confirm("Redirect o'chirilsinmi?")) del.mutate(r.id)
                    }}
                  >
                    <Trash2 />
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Section>
  )
}
