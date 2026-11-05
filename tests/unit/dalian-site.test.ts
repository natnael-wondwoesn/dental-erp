// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'

const site = join(process.cwd(), 'sites/dalian-dental')
const dist = join(site, 'dist')

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? htmlFiles(path) : name.endsWith('.html') ? [path] : []
  })
}

describe('Dalian Dental landing site', () => {
  beforeAll(() => {
    execFileSync('node', [join(site, 'build.mjs')], { stdio: 'ignore' })
  })
  afterAll(() => rmSync(dist, { recursive: true, force: true }))

  it('builds every page, including one page per treatment', () => {
    const content = JSON.parse(readFileSync(join(site, 'content.json'), 'utf8'))
    for (const path of ['index.html', 'services', 'gallery', 'about', 'blog', 'contact']) {
      expect(existsSync(join(dist, path === 'index.html' ? path : `${path}/index.html`))).toBe(true)
    }
    for (const s of content.services) {
      expect(existsSync(join(dist, 'services', s.slug, 'index.html'))).toBe(true)
    }
  })

  it('has no broken internal links or images, one h1 and a title on every page', () => {
    for (const file of htmlFiles(dist)) {
      const html = readFileSync(file, 'utf8')
      expect(html.match(/<h1/g)?.length, file).toBe(1)
      expect(html, file).toMatch(/<title>[^<]{10,}<\/title>/)
      for (const m of html.matchAll(/(?:href|src)="([^"]*)"/g)) {
        const url = m[1].split('#')[0].split('?')[0]
        if (!url || /^(https?:|mailto:|tel:|data:)/.test(url)) continue
        let target = normalize(join(dirname(file), url))
        if (existsSync(target) && statSync(target).isDirectory())
          target = join(target, 'index.html')
        expect(existsSync(target), `${file} -> ${url}`).toBe(true)
      }
      expect(html, file).not.toMatch(/<img(?![^>]*\balt=)/)
    }
  })

  it('uses the house fonts: Inter (primary) and Poppins (secondary), self-hosted', () => {
    const css = readFileSync(join(dist, 'assets/style.css'), 'utf8')
    const fonts = readFileSync(join(dist, 'assets/fonts.css'), 'utf8')
    expect(css).toContain('var(--font-primary)')
    expect(css).toContain('var(--font-secondary)')
    expect(fonts).toMatch(/--font-primary:\s*'Inter'/)
    expect(fonts).toMatch(/--font-secondary:\s*'Poppins'/)
    expect(existsSync(join(dist, 'assets/fonts/inter-latin-wght-normal.woff2'))).toBe(true)
    expect(existsSync(join(dist, 'assets/fonts/poppins-latin-600-normal.woff2'))).toBe(true)
    for (const file of htmlFiles(dist)) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/fonts\.googleapis|fonts\.gstatic/)
    }
  })

  it('has slide/fade animations that switch off for visitors who prefer reduced motion', () => {
    const css = readFileSync(join(dist, 'assets/style.css'), 'utf8')
    const js = readFileSync(join(dist, 'assets/main.js'), 'utf8')
    expect(css).toMatch(/\.reveal\.from-left/)
    expect(css).toMatch(/\.reveal\.from-right/)
    expect(css).toMatch(/@keyframes slide-in-right/)
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation: none/)
    expect(js).toContain('prefers-reduced-motion: reduce')
    // Content must stay visible without JavaScript: hiding is only ever added by the script.
    expect(css).not.toMatch(/^\s*(?:body|main|section)[^{]*\{[^}]*opacity:\s*0/m)
  })

  it('uses Telegram, not WhatsApp, and shows no unfilled placeholders', () => {
    for (const file of htmlFiles(dist)) {
      const html = readFileSync(file, 'utf8')
      expect(html, file).not.toMatch(/whatsapp|wa\.me/i)
      expect(html, file).not.toContain('TODO')
    }
    const contact = readFileSync(join(dist, 'contact/index.html'), 'utf8')
    expect(contact).toContain('data-telegram=')
  })
})
