import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Download, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import type { z } from 'zod'
import { api, isApiError } from '@/lib/api'
import { backupCodeSchema, loginSchema, totpSchema } from '@/lib/schemas'
import type { LoginResult, TwoFaSetup, User, VerifyResult } from '@/lib/types'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError } from '@/components/form/Field'
import { downloadBlob } from '@/lib/utils'

type Step =
  | { kind: 'credentials' }
  | { kind: 'totp' }
  | { kind: 'setup'; setup: TwoFaSetup }
  | { kind: 'backup_codes'; user: User; codes: string[] }

function loginErrorMessage(e: unknown): string {
  if (isApiError(e)) {
    if (e.status === 423) return "Hisob vaqtincha bloklangan: juda ko'p xato urinish. 15 daqiqadan keyin qayta urinib ko'ring."
    if (e.status === 429) {
      return e.retryAfter != null
        ? `Juda ko'p urinish. ${e.retryAfter} soniyadan keyin qayta urinib ko'ring.`
        : "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring."
    }
    if (e.status >= 500) return "Serverda xato. Birozdan keyin urinib ko'ring."
    // Bir xil xabar: email yoki parol qaysi biri xatoligini oshkor qilmaymiz (TZ 8).
    return "Email yoki parol noto'g'ri"
  }
  return "Server bilan aloqa yo'q. Internetni tekshiring."
}

function codeErrorMessage(e: unknown): string {
  if (isApiError(e)) {
    if (e.status === 429 || e.status === 423) return loginErrorMessage(e)
    if (e.status === 401 && e.type === 'unauthorized') return "Kod noto'g'ri yoki sessiya muddati tugagan"
    return "Kod noto'g'ri"
  }
  return "Server bilan aloqa yo'q. Internetni tekshiring."
}

export default function LoginPage() {
  const { user, setUser } = useAuth()
  const [step, setStep] = React.useState<Step>({ kind: 'credentials' })
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = params.get('next') || '/'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'

  if (user && step.kind !== 'backup_codes') return <Navigate to={safeNext} replace />

  const finish = (u: User) => {
    setUser(u)
    navigate(safeNext, { replace: true })
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="font-display text-2xl font-black tracking-tight">
            jamolxon<span className="text-primary">.uz</span>
          </p>
          <p className="text-sm text-muted-foreground">Admin panel</p>
        </div>
        {step.kind === 'credentials' && (
          <CredentialsStep
            onResult={async (r) => {
              if (r.status === '2fa_required') {
                setStep({ kind: 'totp' })
                return
              }
              const setup = await api<TwoFaSetup>('/auth/2fa/setup', { method: 'POST' })
              setStep({ kind: 'setup', setup })
            }}
          />
        )}
        {step.kind === 'totp' && <TotpStep onDone={(r) => finish(r.user)} onBack={() => setStep({ kind: 'credentials' })} />}
        {step.kind === 'setup' && (
          <SetupStep
            setup={step.setup}
            onDone={(r) => {
              if (r.backup_codes && r.backup_codes.length > 0) {
                setStep({ kind: 'backup_codes', user: r.user, codes: r.backup_codes })
              } else {
                finish(r.user)
              }
            }}
          />
        )}
        {step.kind === 'backup_codes' && <BackupCodesStep codes={step.codes} onContinue={() => finish(step.user)} />}
      </div>
    </main>
  )
}

function FormAlert({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-md border border-red bg-red/15 px-3 py-2 text-sm">
      {message}
    </div>
  )
}

function CredentialsStep({ onResult }: { onResult: (r: LoginResult) => Promise<void> }) {
  const [error, setError] = React.useState<string | null>(null)
  const [showPw, setShowPw] = React.useState(false)
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      const r = await api<LoginResult>('/auth/login', { method: 'POST', body: values })
      await onResult(r)
    } catch (e) {
      setError(loginErrorMessage(e))
    }
  })
  const { errors, isSubmitting } = form.formState
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kirish</CardTitle>
        <CardDescription>Email va parolingizni kiriting</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <FormAlert message={error} />
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" aria-invalid={!!errors.email} {...form.register('email')} />
            <FieldError message={errors.email?.message} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Parol</Label>
            <div className="relative">
              <Input id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password" className="pr-10" aria-invalid={!!errors.password} {...form.register('password')} />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                aria-pressed={showPw}
                title={showPw ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <FieldError message={errors.password?.message} />
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting && <Loader2 className="animate-spin" />} Kirish
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function CodeForm({ onDone, submitLabel }: { onDone: (r: VerifyResult) => void; submitLabel: string }) {
  const [error, setError] = React.useState<string | null>(null)
  const form = useForm<z.infer<typeof totpSchema>>({ resolver: zodResolver(totpSchema), defaultValues: { code: '' } })
  const submit = form.handleSubmit(async ({ code }) => {
    setError(null)
    try {
      onDone(await api<VerifyResult>('/auth/2fa/verify', { method: 'POST', body: { code } }))
    } catch (e) {
      setError(codeErrorMessage(e))
    }
  })
  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FormAlert message={error} />
      <div className="grid gap-2">
        <Label htmlFor="code">Ilovadagi 6 xonali kod</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          className="text-center font-display text-xl tracking-[0.4em]"
          aria-invalid={!!form.formState.errors.code}
          {...form.register('code')}
        />
        <FieldError message={form.formState.errors.code?.message} />
      </div>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Loader2 className="animate-spin" />} {submitLabel}
      </Button>
    </form>
  )
}

function TotpStep({ onDone, onBack }: { onDone: (r: VerifyResult) => void; onBack: () => void }) {
  const [useBackup, setUseBackup] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const backupForm = useForm<z.infer<typeof backupCodeSchema>>({
    resolver: zodResolver(backupCodeSchema),
    defaultValues: { backup_code: '' },
  })
  const submitBackup = backupForm.handleSubmit(async ({ backup_code }) => {
    setError(null)
    try {
      onDone(await api<VerifyResult>('/auth/2fa/verify', { method: 'POST', body: { backup_code } }))
    } catch (e) {
      setError(codeErrorMessage(e))
    }
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Ikki bosqichli tekshiruv
        </CardTitle>
        <CardDescription>
          {useBackup ? 'Saqlab qo‘ygan zaxira kodlaringizdan birini kiriting' : 'Autentifikator ilovasidagi kodni kiriting'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {useBackup ? (
          <form onSubmit={submitBackup} className="grid gap-4" noValidate>
            <FormAlert message={error} />
            <div className="grid gap-2">
              <Label htmlFor="backup_code">Zaxira kod</Label>
              <Input
                id="backup_code"
                placeholder="xxxx-xxxx"
                autoComplete="off"
                autoFocus
                aria-invalid={!!backupForm.formState.errors.backup_code}
                {...backupForm.register('backup_code')}
              />
              <FieldError message={backupForm.formState.errors.backup_code?.message} />
            </div>
            <Button type="submit" disabled={backupForm.formState.isSubmitting}>
              Tasdiqlash
            </Button>
          </form>
        ) : (
          <CodeForm onDone={onDone} submitLabel="Tasdiqlash" />
        )}
        <Button variant="link" onClick={() => setUseBackup((v) => !v)}>
          <KeyRound /> {useBackup ? 'Ilova kodi bilan kirish' : 'Zaxira kod bilan kirish'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onBack}>
          Orqaga
        </Button>
      </CardContent>
    </Card>
  )
}

function SetupStep({ setup, onDone }: { setup: TwoFaSetup; onDone: (r: VerifyResult) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>2FA ni yoqing</CardTitle>
        <CardDescription>
          Google Authenticator, 1Password yoki Aegis kabi ilova bilan QR kodni skanerlang, so‘ng ilovadagi kodni kiriting.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="mx-auto rounded-lg bg-cream p-3" data-testid="totp-qr">
          <QRCodeSVG value={setup.otpauth_url} size={180} bgColor="#FFF1DC" fgColor="#250104" />
        </div>
        <div className="grid gap-1 text-center">
          <span className="text-xs text-muted-foreground">Skaner ishlamasa, kalitni qo‘lda kiriting:</span>
          <code className="select-all break-all rounded bg-maroon-2 px-2 py-1 font-mono text-sm" data-testid="totp-secret">
            {setup.secret}
          </code>
        </div>
        <CodeForm onDone={onDone} submitLabel="Tasdiqlash va yoqish" />
      </CardContent>
    </Card>
  )
}

function BackupCodesStep({ codes, onContinue }: { codes: string[]; onContinue: () => void }) {
  const [saved, setSaved] = React.useState(false)
  const text = codes.join('\n')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Nusxa olindi')
      setSaved(true)
    } catch {
      toast.error("Nusxa olib bo'lmadi, qo'lda ko'chiring")
    }
  }
  const download = () => {
    downloadBlob(new Blob([`jamolxon.uz admin — zaxira kodlar\n\n${text}\n`], { type: 'text/plain' }), 'jamolxon-zaxira-kodlar.txt')
    setSaved(true)
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Zaxira kodlar</CardTitle>
        <CardDescription>
          Bu kodlar faqat hozir bir marta ko‘rsatiladi. Telefon yo‘qolsa, har bir kod bilan bir marta kirish mumkin. Xavfsiz joyda saqlang.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm" aria-label="Zaxira kodlar">
          {codes.map((c) => (
            <li key={c} className="rounded bg-maroon-2 px-2 py-1.5 text-center">
              {c}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={copy}>
            <Copy /> Nusxa olish
          </Button>
          <Button variant="outline" onClick={download}>
            <Download /> Yuklab olish
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="accent-[#CDF73D]" />
          Kodlarni saqladim
        </label>
        <Button onClick={onContinue} disabled={!saved}>
          Davom etish
        </Button>
      </CardContent>
    </Card>
  )
}
