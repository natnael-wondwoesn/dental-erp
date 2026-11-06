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
    expect(css).toMatch(/data-r='left'/)
    expect(css).toMatch(/data-r='right'/)
    expect(css).toMatch(/@keyframes slide-in-right/)
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation: none/)
    expect(js).toContain('prefers-reduced-motion: reduce')
    // Content must stay visible without JavaScript: hiding is only ever added by the script.
    expect(css).not.toMatch(/^\s*(?:body|main|section)[^{]*\{[^}]*opacity:\s*0/m)
  })

  it('home page has the trust indicators and the founder story', () => {
    const home = readFileSync(join(dist, 'index.html'), 'utf8')
    for (const label of [
      'Doctors and specialists',
      'Treatment areas',
      'Years of Excellence',
      'Happy Smiles Created',
    ]) {
      expect(home).toContain(label)
    }
    expect(home).toContain('data-count="1000"')
    expect(home).toContain('data-count="13"')
    expect(home).toContain('Founded by Dr. Ferhana Adem')
    expect(home).toContain('Founder / Expert Dental Surgeon')
    expect(home).toContain('images/doctor-gloves.jpg')
  })

  it('shows the map, the logo, the extra staff and the clinic photos', () => {
    const contact = readFileSync(join(dist, 'contact/index.html'), 'utf8')
    expect(contact).toContain('google.com/maps?q=8.9946209,38.790487')
    expect(contact).toContain('maps.app.goo.gl/2UyXoSpZfLedUp3F7')
    const home = readFileSync(join(dist, 'index.html'), 'utf8')
    expect(home).toContain('images/brand/logo-mark.png')
    for (const name of [
      'Dr. Merhawit Zerabiruk',
      'Sister Rahel Gosaye',
      'Sister Roman Birhanu',
      'Aregash Teferi',
      'Seida Surur',
    ]) {
      expect(home).toContain(name)
    }
    expect(existsSync(join(dist, 'images/brand/favicon.ico'))).toBe(true)
    const gallery = readFileSync(join(dist, 'gallery/index.html'), 'utf8')
    expect(gallery).toContain('smile-makeover-1')
    expect(gallery).toContain('treatment-room-window.jpg')
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
