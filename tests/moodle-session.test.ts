import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const cookieState = vi.hoisted(() => new Map<string, { value: string; options?: Record<string, unknown> }>())

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieState.get(name),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      cookieState.set(name, { value, options })
    },
  }),
}))

import {
  createPendingMoodleSession,
  createMoodleSession,
  destroyMoodleSession,
  getMoodleSession,
  getPendingMoodleSession,
} from '@/lib/moodle-session'

beforeEach(() => {
  cookieState.clear()
  process.env.SESSION_ENCRYPTION_KEYS = `test:${'81'.repeat(32)}`
})

describe('Moodle token cookie', () => {
  it('stores only the token session in a path-scoped encrypted cookie', async () => {
    await createMoodleSession({
      token: 'moodle-token-at-least-sixteen-characters',
      userId: 1234,
      username: '000000.00000',
      fullName: 'Aluno',
      totvsRa: '000000.00000',
    })

    const cookie = cookieState.get('sapoconnect_moodle')
    expect(cookie?.value).not.toContain('moodle-token')
    expect(cookie?.options).toMatchObject({ httpOnly: true, path: '/api/moodle', sameSite: 'lax' })
    expect((await getMoodleSession('000000.00000'))?.userId).toBe(1234)
    expect(await getMoodleSession('outro-ra')).toBeNull()
  })

  it('expires the same scoped cookie on disconnect', async () => {
    await destroyMoodleSession()
    expect(cookieState.get('sapoconnect_moodle')).toMatchObject({
      value: '',
      options: { path: '/api/moodle', maxAge: 0 },
    })
  })

  it('keeps a newly issued token briefly so a partial login can resume', async () => {
    await createPendingMoodleSession(
      'pending-token-at-least-sixteen-characters',
      '000000.00000',
    )

    expect(await getMoodleSession('000000.00000')).toBeNull()
    expect((await getPendingMoodleSession('000000.00000'))?.token).toBe(
      'pending-token-at-least-sixteen-characters',
    )
    expect(cookieState.get('sapoconnect_moodle')?.options).toMatchObject({ maxAge: 600 })
  })
})
