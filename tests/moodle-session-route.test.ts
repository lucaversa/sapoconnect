import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const appSession = vi.hoisted(() => ({
  getSession: vi.fn(),
}))
const moodleSession = vi.hoisted(() => ({
  getMoodleSession: vi.fn(),
  getPendingMoodleSession: vi.fn(),
  createMoodleSession: vi.fn(),
  createPendingMoodleSession: vi.fn(),
  destroyMoodleSession: vi.fn(),
}))
const moodleClient = vi.hoisted(() => ({
  requestMoodleToken: vi.fn(),
  getMoodleSiteInfo: vi.fn(),
}))

vi.mock('@/lib/session', () => appSession)
vi.mock('@/lib/moodle-session', () => moodleSession)
vi.mock('@/lib/moodle-client', () => ({
  MoodleClientError: class MoodleClientError extends Error {},
  getMoodlePublicUrl: () => 'https://ava.cmmg.edu.br',
  requestMoodleToken: moodleClient.requestMoodleToken,
  getMoodleSiteInfo: moodleClient.getMoodleSiteInfo,
}))
vi.mock('@/lib/server/request-guard', () => ({
  RequestGuardError: class RequestGuardError extends Error {},
  guardAuthRequest: vi.fn(),
  guardSameOriginRequest: vi.fn(),
}))

import { POST } from '@/app/api/moodle/session/route'

const connected = {
  version: 1 as const,
  token: 'server-only-moodle-token',
  userId: 1234,
  username: '000000.00000',
  fullName: 'Aluno',
  totvsRa: '000000.00000',
  connectedAt: 1_000,
  expiresAt: Date.now() + 60_000,
}

function request(password = 'secret') {
  return new Request('https://app.example.com/api/moodle/session', {
    method: 'POST',
    headers: {
      origin: 'https://app.example.com',
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ password }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  appSession.getSession.mockResolvedValue({ ra: '000000.00000' })
  moodleSession.getPendingMoodleSession.mockResolvedValue(null)
})

describe('Moodle connection route', () => {
  it('is idempotent and never requests another token when already connected', async () => {
    moodleSession.getMoodleSession.mockResolvedValue(connected)

    const response = await POST(request())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({ connected: true, username: connected.username })
    expect(payload).not.toHaveProperty('token')
    expect(moodleClient.requestMoodleToken).not.toHaveBeenCalled()
  })

  it('requests exactly one token on an explicit first connection and never returns it', async () => {
    moodleSession.getMoodleSession.mockResolvedValue(null)
    moodleClient.requestMoodleToken.mockResolvedValue('new-token')
    moodleClient.getMoodleSiteInfo.mockResolvedValue({
      userid: 1234,
      username: '000000.00000',
      fullname: 'Aluno',
    })
    moodleSession.createMoodleSession.mockResolvedValue(connected)

    const response = await POST(request())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(moodleClient.requestMoodleToken).toHaveBeenCalledTimes(1)
    expect(moodleClient.requestMoodleToken).toHaveBeenCalledWith('000000.00000', 'secret')
    expect(moodleSession.createPendingMoodleSession).toHaveBeenCalledWith('new-token', '000000.00000')
    expect(payload).not.toHaveProperty('token')
  })

  it('reuses a pending token after a partial post-login failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    moodleSession.getMoodleSession.mockResolvedValue(null)
    moodleSession.getPendingMoodleSession
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ token: 'pending-token-at-least-sixteen-characters' })
    moodleClient.requestMoodleToken.mockResolvedValue('pending-token-at-least-sixteen-characters')
    moodleClient.getMoodleSiteInfo
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({ userid: 1234, username: '000000.00000' })
    moodleSession.createMoodleSession.mockResolvedValue(connected)

    const firstResponse = await POST(request())
    const retryResponse = await POST(request())

    expect(firstResponse.status).toBe(500)
    expect(retryResponse.status).toBe(200)
    expect(moodleClient.requestMoodleToken).toHaveBeenCalledTimes(1)
    expect(moodleClient.getMoodleSiteInfo).toHaveBeenCalledTimes(2)
  })
})
