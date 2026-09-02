import { parseApiError } from '@/lib/api-response-error'
import { apiFetch } from '@/lib/fetch-client'
import type { TotvsMaterial } from '@/lib/totvs-materials-types'

export async function downloadTotvsMaterial(material: Pick<TotvsMaterial, 'id' | 'fileName'>) {
  if (!/^\d+$/.test(material.id)) throw new Error('Arquivo inválido.')
  const response = await apiFetch(`/api/totvs/files?id=${material.id}`)
  if (!response.ok) throw await parseApiError(response)
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = material.fileName.replace(/[\x00-\x1f\x7f/\\]/g, '_') || 'arquivo'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Allow mobile browsers to consume the blob before revoking it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
