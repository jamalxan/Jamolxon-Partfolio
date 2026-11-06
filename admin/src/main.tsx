import * as React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/unbounded/600.css'
import '@fontsource/unbounded/700.css'
import '@fontsource/unbounded/800.css'
import '@fontsource/unbounded/900.css'
import './index.css'
import { App } from './App'

async function enableMocks() {
  // `npm run dev:mock` — backend o'rniga MSW. Prod build'ga kirmaydi (import.meta.env.DEV).
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true') {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
  }
}

void enableMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
