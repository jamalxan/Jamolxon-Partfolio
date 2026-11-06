import * as React from 'react'

/** `mod` = Ctrl (Windows/Linux) yoki Cmd (macOS). Masalan: useHotkey('mod+s', save). */
export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void, enabled = true) {
  const ref = React.useRef(handler)
  ref.current = handler
  React.useEffect(() => {
    if (!enabled) return
    const parts = combo.toLowerCase().split('+')
    const key = parts[parts.length - 1]
    const needMod = parts.includes('mod')
    const needShift = parts.includes('shift')
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key) return
      if (needMod && !(e.ctrlKey || e.metaKey)) return
      if (needShift !== e.shiftKey) return
      e.preventDefault()
      ref.current(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [combo, enabled])
}
