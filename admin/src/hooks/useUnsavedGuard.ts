import * as React from 'react'
import { useBlocker } from 'react-router-dom'

const MESSAGE = "Saqlanmagan o'zgarishlar bor. Sahifadan chiqasizmi?"

/**
 * Saqlanmagan o'zgarish bo'lsa: brauzer yopilishi/yangilanishida (beforeunload)
 * va ilova ichidagi o'tishda ogohlantiradi.
 * `bypass()` — saqlangandan keyingi navigatsiyani to'xtatmaslik uchun.
 */
export function useUnsavedGuard(dirty: boolean) {
  const dirtyRef = React.useRef(dirty)
  dirtyRef.current = dirty
  const bypassRef = React.useRef(false)

  React.useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current || bypassRef.current) return
      e.preventDefault()
      e.returnValue = MESSAGE
      return MESSAGE
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const blocker = useBlocker(
    React.useCallback(
      ({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) =>
        dirtyRef.current && !bypassRef.current && currentLocation.pathname !== nextLocation.pathname,
      [],
    ),
  )

  React.useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm(MESSAGE)) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  return {
    bypass: React.useCallback(() => {
      bypassRef.current = true
      // Keyingi tahrirlarda yana himoya yoqiladi
      setTimeout(() => {
        bypassRef.current = false
      }, 0)
    }, []),
  }
}
