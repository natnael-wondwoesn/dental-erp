import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(__dirname, '../..')
const fleet = JSON.parse(readFileSync(path.join(root, 'ops/deploy/fleet.json'), 'utf8')) as {
  sites: { client: string; backend?: boolean }[]
}
const conf = (client: string) => path.join(root, 'ops/deploy/clients', `${client}.conf`)

describe('release fleet manifest', () => {
  it('lists safe, unique site names', () => {
    const names = fleet.sites.map((site) => site.client)
    expect(names.length).toBeGreaterThan(0)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) expect(name).toMatch(/^[a-z0-9][a-z0-9-]*$/)
  })

  it('rolls the control platform out first so later sites see the new catalog', () => {
    expect(fleet.sites[0]).toEqual({ client: 'control', backend: true })
  })

  it('gives every site that needs a backend roll the settings deploy-backend.sh requires', () => {
    for (const site of fleet.sites.filter((s) => s.backend)) {
      expect(existsSync(conf(site.client))).toBe(true)
      const text = readFileSync(conf(site.client), 'utf8')
      for (const key of ['BACKEND_COMPOSE_FILE', 'BACKEND_ENV_FILE', 'BACKEND_SERVICE'])
        expect(text).toMatch(new RegExp(`^${key}=`, 'm'))
    }
  })

  it('release workflow deploys automatically after both images are published', () => {
    const release = readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8')
    expect(release).toMatch(/deploy-fleet:[\s\S]*needs: \[publish, backend-image\]/)
    expect(release).toMatch(/deploy-fleet:[\s\S]*github\.event_name == 'push'/)
  })
})
