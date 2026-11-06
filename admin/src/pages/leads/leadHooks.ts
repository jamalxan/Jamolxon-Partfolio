import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Lead, LeadStatus } from '@/lib/types'

/** PATCH /leads/{id} {status}. Faqat owner (editor uchun UI ko'rsatilmaydi, API 403 qaytaradi). */
export function useLeadStatusMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) => api<Lead>(`/leads/${id}`, { method: 'PATCH', body: { status } }),
    onSettled: (_d, _e, vars) => {
      void qc.invalidateQueries({ queryKey: ['leads'] })
      void qc.invalidateQueries({ queryKey: ['lead', vars.id] })
    },
  })
}
