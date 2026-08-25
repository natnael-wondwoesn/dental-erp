import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { evaluateLicense, type LicenseDecision, type LicenseEvidence } from './license-decision'
import { ISSUER_PUBLIC_KEYS } from './trust-anchors'

export type LicenseEnforcement = 'disabled' | 'audit' | 'required'

export interface RuntimeLicenseDecision extends Omit<LicenseDecision, 'next_evidence'> {
  enforcement: LicenseEnforcement
  product_id: string
  installation_id?: string
  expires_at?: string
  entitlements: string[]
}

export interface LicenseMaterialStore {
  readLicense(): Promise<string>
  readInstallationId(): Promise<string>
  readEvidence(): Promise<LicenseEvidence>
  writeLicense(value: string): Promise<void>
  writeEvidence(value: LicenseEvidence): Promise<void>
}

const MAX_LICENSE_BYTES = 64 * 1024
const MAX_STATE_BYTES = 256 * 1024

export class FileLicenseMaterialStore implements LicenseMaterialStore {
  constructor(private readonly stateDir: string) {}

  private async read(name: string, maximum = MAX_STATE_BYTES): Promise<string> {
    const filename = path.join(this.stateDir, name)
    const metadata = await lstat(filename)
    if (metadata.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${name}`)
    if (metadata.size > maximum) throw new Error(`License state file is too large: ${name}`)
    return readFile(filename, 'utf8')
  }

  private async write(name: string, value: string): Promise<void> {
    await mkdir(this.stateDir, { recursive: true, mode: 0o700 })
    const destination = path.join(this.stateDir, name)
    const temporary = path.join(this.stateDir, `.${name}.${randomUUID()}.tmp`)
    try {
      await writeFile(temporary, value, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
      await rename(temporary, destination)
    } catch (error) {
      await unlink(temporary).catch(() => undefined)
      throw error
    }
  }

  readLicense(): Promise<string> {
    return this.read('current.lic', MAX_LICENSE_BYTES)
  }

  async readInstallationId(): Promise<string> {
    const value: unknown = JSON.parse(await this.read('installation.json'))
    if (
      typeof value !== 'object' ||
      value === null ||
      !('installation_id' in value) ||
      typeof value.installation_id !== 'string'
    ) {
      throw new Error('Invalid installation identity')
    }
    return value.installation_id
  }

  async readEvidence(): Promise<LicenseEvidence> {
    try {
      const value: unknown = JSON.parse(await this.read('evidence.json'))
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('Invalid license evidence')
      }
      return value as LicenseEvidence
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {}
      throw error
    }
  }

  async writeLicense(value: string): Promise<void> {
    if (Buffer.byteLength(value) > MAX_LICENSE_BYTES) throw new Error('License file is too large')
    await this.write('current.lic', value)
  }

  writeEvidence(value: LicenseEvidence): Promise<void> {
    return this.write('evidence.json', JSON.stringify(value))
  }
}

export interface LicenseRuntimeOptions {
  enforcement: LicenseEnforcement
  productId: string
  store: LicenseMaterialStore
  publicKeys: Readonly<Record<string, string>>
}

export class LicenseRuntime {
  private operation: Promise<void> = Promise.resolve()

  constructor(private readonly options: LicenseRuntimeOptions) {}

  private async exclusively<T>(action: () => Promise<T>): Promise<T> {
    const previous = this.operation
    let release!: () => void
    this.operation = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    try {
      return await action()
    } finally {
      release()
    }
  }

  private disabled(): RuntimeLicenseDecision {
    return {
      enforcement: 'disabled',
      state: 'active',
      reason: 'ok',
      allows_read: true,
      allows_write: true,
      allows_recovery: true,
      product_id: this.options.productId,
      entitlements: [],
    }
  }

  private runtimeDecision(
    decision: LicenseDecision,
    installationId?: string
  ): RuntimeLicenseDecision {
    return {
      enforcement: this.options.enforcement,
      state: decision.state,
      reason: decision.reason,
      payload: decision.payload,
      allows_read: decision.allows_read,
      allows_write: decision.allows_write,
      allows_recovery: true,
      product_id: this.options.productId,
      installation_id: installationId,
      expires_at: decision.payload?.expires_at,
      entitlements: decision.payload?.entitlements ?? [],
    }
  }

  async decide(now = new Date()): Promise<RuntimeLicenseDecision> {
    if (this.options.enforcement === 'disabled') return this.disabled()
    return this.exclusively(async () => {
      let installationId: string | undefined
      try {
        installationId = await this.options.store.readInstallationId()
        const decision = evaluateLicense({
          license: await this.options.store.readLicense(),
          product_id: this.options.productId,
          installation_id: installationId,
          public_keys: this.options.publicKeys,
          now,
          evidence: await this.options.store.readEvidence(),
        })
        await this.options.store.writeEvidence(decision.next_evidence)
        return this.runtimeDecision(decision, installationId)
      } catch {
        const decision = evaluateLicense({
          license: {},
          product_id: this.options.productId,
          installation_id: installationId ?? 'missing-installation',
          public_keys: {},
          now,
        })
        return this.runtimeDecision(decision, installationId)
      }
    })
  }

  async importLicense(rawLicense: string, now = new Date()): Promise<RuntimeLicenseDecision> {
    if (Buffer.byteLength(rawLicense) > MAX_LICENSE_BYTES)
      throw new Error('License file is too large')
    return this.exclusively(async () => {
      const installationId = await this.options.store.readInstallationId()
      const decision = evaluateLicense({
        license: rawLicense,
        product_id: this.options.productId,
        installation_id: installationId,
        public_keys: this.options.publicKeys,
        now,
        evidence: await this.options.store.readEvidence(),
      })
      if (!decision.allows_write) throw new Error(`License cannot be activated: ${decision.reason}`)
      await this.options.store.writeLicense(rawLicense)
      await this.options.store.writeEvidence(decision.next_evidence)
      return this.runtimeDecision(decision, installationId)
    })
  }
}

export function licenseEnforcement(): LicenseEnforcement {
  const value = process.env.LICENSE_ENFORCEMENT ?? 'disabled'
  if (value !== 'disabled' && value !== 'audit' && value !== 'required') {
    throw new Error('LICENSE_ENFORCEMENT must be disabled, audit, or required')
  }
  return value
}

let runtime: LicenseRuntime | undefined

export function getLicenseRuntime(): LicenseRuntime {
  if (!runtime) {
    runtime = new LicenseRuntime({
      enforcement: licenseEnforcement(),
      productId: process.env.LICENSE_PRODUCT_ID ?? 'dental-erp',
      store: new FileLicenseMaterialStore(process.env.LICENSE_STATE_DIR ?? '.license-state'),
      publicKeys: ISSUER_PUBLIC_KEYS,
    })
  }
  return runtime
}

export function resetLicenseRuntimeForTests(): void {
  runtime = undefined
}
