/**
 * jsdom FormData/File/Blob'ni Node (undici) fetch tushunmaydi: multipart body "[object FormData]" bo'lib ketadi.
 * Testlarda ularni Node'ning native klasslari bilan almashtiramiz (setup'da birinchi import bo'lishi shart).
 */
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'

const empty = await new Response('', { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).formData()
const NativeFormData = empty.constructor as typeof FormData

for (const target of [globalThis, window] as Record<string, unknown>[]) {
  target.FormData = NativeFormData
  target.File = NodeFile
  target.Blob = NodeBlob
}
