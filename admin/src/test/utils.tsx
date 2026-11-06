import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { createQueryClient, Providers } from '@/App'
import { routes } from '@/routes'
import { loginAs } from '@/mocks/handlers'

export function renderApp(path: string, opts: { as?: 'u-owner' | 'u-editor' | null } = {}) {
  const as = opts.as === undefined ? 'u-owner' : opts.as
  if (as) loginAs(as)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const client = createQueryClient()
  const user = userEvent.setup()
  const utils = render(
    <Providers client={client}>
      <RouterProvider router={router} />
    </Providers>,
  )
  return { ...utils, router, client, user }
}
