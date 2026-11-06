import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isApiError } from './api'

/**
 * Pydantic `loc` turli ko'rinishda kelishi mumkin: `slug`, `body.slug`, `sections.0.h`, `sections[0].h`.
 * Hammasini RHF yo'liga (`sections.0.h`) keltiramiz.
 */
export function normalizeField(field: string): string {
  return field
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/^body\./, '')
    .replace(/^\./, '')
}

/**
 * 422 javobidagi `errors[].field` ni forma maydonlariga bog'laydi.
 * Formada yo'q maydonlar uchun xatolar qaytariladi (umumiy xabar sifatida ko'rsatish uchun).
 * @returns forma maydoniga bog'lanmagan xabarlar
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly string[],
): string[] {
  if (!isApiError(error) || error.fieldErrors.length === 0) return []
  const rest: string[] = []
  let focused = false
  for (const fe of error.fieldErrors) {
    const path = normalizeField(fe.field)
    const root = path.split('.')[0]
    if (knownFields.includes(root)) {
      setError(path as Path<T>, { type: 'server', message: fe.msg }, { shouldFocus: !focused })
      focused = true
    } else {
      rest.push(fe.field ? `${fe.field}: ${fe.msg}` : fe.msg)
    }
  }
  return rest
}
