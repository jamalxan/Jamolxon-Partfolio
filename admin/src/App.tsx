import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createBrowserRouter, type RouterProviderProps } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/auth/AuthProvider'
import { isApiError } from '@/lib/api'
import { routes } from './routes'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        retry: (count, err) => {
          // 4xx xatolarni qayta urinish befoyda
          if (isApiError(err) && err.status < 500) return false
          return count < 2
        },
      },
      mutations: { retry: false },
    },
  })
}

export function Providers({ client, children }: { client: QueryClient; children: React.ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
      <Toaster
        theme="dark"
        position="top-right"
        richColors
        closeButton
        toastOptions={{ style: { background: '#330408', border: '1px solid rgb(92 40 40)', color: '#FFF1DC' } }}
      />
    </QueryClientProvider>
  )
}

export function App({ router }: { router?: RouterProviderProps['router'] }) {
  const [client] = React.useState(createQueryClient)
  const [r] = React.useState(() => router ?? createBrowserRouter(routes))
  return (
    <Providers client={client}>
      <RouterProvider router={r} />
    </Providers>
  )
}
