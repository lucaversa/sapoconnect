import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiResponseError } from '@/lib/api-response-error'
import { downloadTotvsMaterial } from '@/lib/download-totvs-material'

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('@/lib/fetch-client', () => ({ apiFetch: mocks.apiFetch }))

let link: { href: string; download: string; click: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }
let appendChild: ReturnType<typeof vi.fn>
let createElement: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  link = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
  appendChild = vi.fn()
  createElement = vi.fn().mockReturnValue(link)
  vi.stubGlobal('document', { createElement, body: { appendChild } })
  vi.stubGlobal('window', { setTimeout })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:materials-test')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  mocks.apiFetch.mockResolvedValue(new Response(new Blob(['PDF contents'], { type: 'application/pdf' })))
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('downloadTotvsMaterial', () => {
  it('uses only the authenticated local file ID endpoint, ignoring a supplied public URL', async () => {
    const material = {
      id: '701',
      fileName: 'roteiro.pdf',
      downloadUrl: 'https://untrusted.example/file?token=must-not-be-used',
    }

    await downloadTotvsMaterial(material)

    expect(mocks.apiFetch).toHaveBeenCalledExactlyOnceWith('/api/totvs/files?id=701')
    expect(createElement).toHaveBeenCalledExactlyOnceWith('a')
    expect(link.href).toBe('blob:materials-test')
    expect(link.download).toBe('roteiro.pdf')
    expect(appendChild).toHaveBeenCalledExactlyOnceWith(link)
    expect(link.click).toHaveBeenCalledOnce()
    expect(link.remove).toHaveBeenCalledOnce()
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob
    expect(await blob.text()).toBe('PDF contents')
  })

  it('sanitizes path separators and control characters in the download filename', async () => {
    await downloadTotvsMaterial({ id: '701', fileName: 'pasta/Plano\\Semana\u0000.pdf' })

    expect(link.download).toBe('pasta_Plano_Semana_.pdf')
  })

  it('uses a nonempty fallback filename', async () => {
    await downloadTotvsMaterial({ id: '701', fileName: '' })

    expect(link.download).toBe('arquivo')
  })

  it('keeps the blob alive for mobile downloads, then revokes it', async () => {
    await downloadTotvsMaterial({ id: '701', fileName: 'roteiro.pdf' })

    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(59_999)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:materials-test')
  })

  it('rejects a 401 session error without creating a download blob or link', async () => {
    mocks.apiFetch.mockResolvedValue(Response.json({ error: 'Sessão expirada', code: 'SESSION_EXPIRED' }, { status: 401 }))

    const result = downloadTotvsMaterial({ id: '701', fileName: 'roteiro.pdf' })

    await expect(result).rejects.toBeInstanceOf(ApiResponseError)
    await expect(result).rejects.toMatchObject({ status: 401, code: 'SESSION_EXPIRED', message: 'Sessão expirada' })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(createElement).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['', '../701', '701&url=https://untrusted.example', 'https://totvs.example/file', 'totvs-701'])('rejects nonnumeric ID %j before making a request', async (id) => {
    await expect(downloadTotvsMaterial({ id, fileName: 'roteiro.pdf' })).rejects.toThrow('Arquivo inválido')

    expect(mocks.apiFetch).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})
