import { afterEach, describe, expect, it } from 'vitest'
import { isPlatformControlPlane } from '@/lib/platform-mode'

const original = process.env.PLATFORM_CONTROL_PLANE_MODE

afterEach(() => {
  if (original === undefined) delete process.env.PLATFORM_CONTROL_PLANE_MODE
  else process.env.PLATFORM_CONTROL_PLANE_MODE = original
})

describe('platform control-plane mode', () => {
  it.each(['1', 'true', 'TRUE', 'yes'])('accepts %s as enabled', (value) => {
    process.env.PLATFORM_CONTROL_PLANE_MODE = value
    expect(isPlatformControlPlane()).toBe(true)
  })

  it.each([undefined, '', 'false', '0', 'typo'])('is disabled for %s', (value) => {
    if (value === undefined) delete process.env.PLATFORM_CONTROL_PLANE_MODE
    else process.env.PLATFORM_CONTROL_PLANE_MODE = value
    expect(isPlatformControlPlane()).toBe(false)
  })
})
