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
    for (const path of ['index.html', 'services', 'gallery', 'about', 'learn', 'contact']) {
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

  it('shows the map, the logo and the clinic photos', () => {
    const contact = readFileSync(join(dist, 'contact/index.html'), 'utf8')
    expect(contact).toContain('google.com/maps?q=8.9946209,38.790487')
    expect(contact).toContain('maps.app.goo.gl/2UyXoSpZfLedUp3F7')
    const home = readFileSync(join(dist, 'index.html'), 'utf8')
    expect(home).toContain('images/brand/logo-mark.png')
    expect(home).toContain('Dr. Merhawit Zerabiruk')
    expect(existsSync(join(dist, 'images/brand/favicon.ico'))).toBe(true)
    const gallery = readFileSync(join(dist, 'gallery/index.html'), 'utf8')
    expect(gallery).toContain('smile-makeover-1')
    expect(gallery).toContain('treatment-room-window.jpg')
  })

  it('gallery follows the redesigned structure: hero, category nav, doctors, clinic, results, CTA', () => {
    const g = readFileSync(join(dist, 'gallery/index.html'), 'utf8')
    expect(g).toContain('See Our Clinic. Meet Our Team. Discover Our Work.')
    expect(g).toContain(
      'Explore our dental clinic, meet our team, and discover examples of our dental treatments.'
    )
    for (const tab of ['All', 'Our Doctors', 'Our Clinic', 'Treatment Results']) {
      expect(g).toMatch(new RegExp(`data-filter="[a-z]+"[^>]*>${tab}<`))
    }
    const order = [
      'id="doctors"',
      'id="clinic"',
      'id="results"',
      'Ready to Take Care of Your Smile?',
    ]
    const at = order.map((s) => g.indexOf(s))
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(g).toContain(
      'Our team is ready to help you take the next step towards better oral health.'
    )
    expect(g).toContain('Book an Appointment')
    // Clinic photos have captions and every image opens in the lightbox.
    expect(g).toContain('<figcaption>Chairside view</figcaption>')
    expect(g).toContain('class="lb')
    // Case cards have real titles and BEFORE/AFTER labels, not "Smile Makeover 1".
    expect(g).toContain('<strong>Orthodontic Treatment</strong>')
    expect(g).toContain('<strong>Smile Restoration</strong>')
    expect(g).not.toMatch(/Smile makeover \d/i)
    expect(g).toContain('<span>Before</span>')
    expect(g).toContain('<span>After</span>')
    // Below-the-fold images are lazy loaded and have real dimensions.
    expect(g).toMatch(/loading="lazy" width="\d+" height="\d+"/)
    const js = readFileSync(join(dist, 'assets/main.js'), 'utf8')
    for (const word of ['Escape', 'ArrowLeft', 'ArrowRight', 'lb-close', 'data-filter']) {
      expect(js).toContain(word)
    }
  })

  it('About page shows only the three cards: Mission, Vision and Core Values', () => {
    const about = readFileSync(join(dist, 'about/index.html'), 'utf8')
    const section = about.slice(about.indexOf('about-cards'), about.indexOf('id="team"'))
    expect(section.match(/<article class="card about-card"/g)?.length).toBe(3)
    for (const title of ['Our Mission', 'Our Vision', 'Our Core Values']) {
      expect(section).toContain(`<h3>${title}</h3>`)
    }
    // The four values live inside the Core Values card, not as cards of their own.
    expect(section).not.toMatch(/<h3>(Professionalism|Integrity|Patient Safety|Compassion)<\/h3>/)
    for (const value of [
      'Professionalism',
      'Integrity',
      'Patient Safety',
      'Compassion',
      'Teamwork',
      'Continuous Improvement',
      'Trust',
      'Innovation',
    ]) {
      expect(section).toContain(`<li>${value}</li>`)
    }
    expect(section).toContain('trusted dental care destination')
    expect(section).toContain('patient-centered dental care')
  })

  it('every treatment page has the five sections, its own title and only its own doctors', () => {
    const content = JSON.parse(readFileSync(join(site, 'content.json'), 'utf8'))
    const titles = new Set<string>()
    const descriptions = new Set<string>()
    for (const s of content.services) {
      const html = readFileSync(join(dist, 'services', s.slug, 'index.html'), 'utf8')
      expect(html, s.slug).toContain('Available Treatment Subcategories')
      expect(html, s.slug).toContain(`Benefits of ${s.name}`)
      expect(html, s.slug).toContain(
        s.detail.specialistsHeading || `Meet Your Specialists for ${s.name}`
      )
      expect(html, s.slug).toContain(`Frequently Asked Questions About ${s.name}`)
      expect(html, s.slug).toContain(`${s.name}: Before &amp; After`)
      // Subcategories, FAQ accordion and structured data come from this treatment's own content.
      for (const sub of s.detail.subcategories) expect(html, s.slug).toContain(sub.name)
      expect(html.match(/<details class="faq"/g)?.length, s.slug).toBe(s.detail.faq.length)
      expect(html, s.slug).toContain('"@type":"FAQPage"')
      // SEO: one h1, a unique title and description.
      expect(html.match(/<h1/g)?.length, s.slug).toBe(1)
      const title = html.match(/<title>([^<]+)<\/title>/)![1]
      const desc = html.match(/name="description" content="([^"]+)"/)![1]
      expect(titles.has(title), `duplicate title ${s.slug}`).toBe(false)
      expect(descriptions.has(desc), `duplicate description ${s.slug}`).toBe(false)
      titles.add(title)
      descriptions.add(desc)
      // Only the doctors assigned to this treatment are shown.
      const spec = html.slice(html.indexOf('id="specialists"'), html.indexOf('id="faq"'))
      for (const d of content.doctors) {
        const assigned = s.doctors.includes(d.id)
        expect(spec.includes(d.name), `${s.slug}: ${d.name}`).toBe(assigned)
      }
      // The booking button carries the treatment so the form can pre-select it.
      expect(html, s.slug).toContain(`contact/?service=${encodeURIComponent(s.name)}#book`)
    }
    const emergencyPage = readFileSync(join(dist, 'services/emergency-care/index.html'), 'utf8')
    expect(emergencyPage).toContain(
      'Meet Your Dentists, Oral and Maxillofacial Surgeon for Emergency Dental Care'
    )
    expect(emergencyPage).not.toContain('Meet Your Specialists for Emergency Dental Care')
    const servicesPage = readFileSync(join(dist, 'services/index.html'), 'utf8')
    expect(servicesPage).toContain('Dentists, Oral and Maxillofacial Surgeon: Dr.')
    // Treatments with no matching photographs say so instead of showing unrelated pictures.
    const emergency = readFileSync(join(dist, 'services/emergency-care/index.html'), 'utf8')
    expect(emergency).toContain('will be added here')
    const ortho = readFileSync(join(dist, 'services/orthodontics/index.html'), 'utf8')
    expect(ortho).toContain('Orthodontic Treatment')
    expect(ortho).toContain('<span>Before</span>')
    // The Services page links every card to its own treatment page.
    const index = readFileSync(join(dist, 'services/index.html'), 'utf8')
    for (const s of content.services) expect(index).toContain(`href="../services/${s.slug}/"`)
  })

  it('Learn hub: every article has its own page, unique SEO tags, structured data, sources and a sitemap entry', () => {
    const dir = join(site, 'articles')
    const slugs = readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
    expect(slugs.length).toBeGreaterThanOrEqual(9)
    const titles = new Set<string>()
    const descriptions = new Set<string>()
    for (const slug of slugs) {
      const html = readFileSync(join(dist, 'learn', slug, 'index.html'), 'utf8')
      const title = html.match(/<title>([^<]+)<\/title>/)![1]
      const description = html.match(/<meta name="description" content="([^"]+)"/)![1]
      expect(titles.has(title), `duplicate title ${title}`).toBe(false)
      expect(descriptions.has(description), `duplicate description ${slug}`).toBe(false)
      titles.add(title)
      descriptions.add(description)
      expect(html).toContain('"@type":"Article"')
      expect(html).toContain('"@type":"BreadcrumbList"')
      expect(html).toContain('id="sources"')
      expect(html).toContain('id="faq"')
      expect(html).toContain('Table of contents')
      expect(html.match(/<h1/g)?.length).toBe(1)
      // Every article cites at least one source and says medical review is pending.
      expect(html.match(/<ol class="sources">[\s\S]*?<li>/)).not.toBeNull()
      expect(html).toContain(
        'Clinical review by a Dalian Speciality Dental Clinic dentist is pending'
      )
    }
    const hub = readFileSync(join(dist, 'learn/index.html'), 'utf8')
    expect(hub).toContain('Your Guide to Better Oral Health')
    expect(hub).toContain('Search dental health topics...')
    expect(hub).toContain('Ready to Take Care of Your Smile?')
    for (const slug of slugs) expect(hub).toContain(`/learn/${slug}/`)
    const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8')
    for (const slug of slugs) expect(sitemap).toContain(`/learn/${slug}/`)
    expect(sitemap).not.toContain('/blog/')
  })

  it('the founder is listed first wherever doctors are shown', () => {
    const content = JSON.parse(readFileSync(join(site, 'content.json'), 'utf8'))
    const founder = content.doctors.find((d: { id: string }) => d.id === content.founder.doctor)
    const firstDoctor = (html: string, from: string, to: string) => {
      const part = html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)))
      const names = content.doctors
        .map((d: { name: string }) => ({ name: d.name, at: part.indexOf(d.name) }))
        .filter((x: { at: number }) => x.at >= 0)
        .sort((a: { at: number }, b: { at: number }) => a.at - b.at)
      return names[0]?.name
    }
    const home = readFileSync(join(dist, 'index.html'), 'utf8')
    expect(firstDoctor(home, 'Specialists you can talk to', 'Our core values')).toBe(founder.name)
    const gallery = readFileSync(join(dist, 'gallery/index.html'), 'utf8')
    expect(firstDoctor(gallery, 'id="doctors"', 'id="clinic"')).toBe(founder.name)
    const about = readFileSync(join(dist, 'about/index.html'), 'utf8')
    expect(firstDoctor(about, 'id="team"', 'Your visit')).toBe(founder.name)
    for (const s of content.services) {
      if (!s.doctors.includes(founder.id)) continue
      const html = readFileSync(join(dist, 'services', s.slug, 'index.html'), 'utf8')
      expect(firstDoctor(html, 'id="specialists"', 'id="faq"'), s.slug).toBe(founder.name)
    }
  })

  it('every card has a real, related photograph and there are no placeholder tiles', () => {
    for (const file of htmlFiles(dist)) {
      const html = readFileSync(file, 'utf8')
      expect(html, file).not.toContain('class="ph"')
      // Treatment cards and article cards always carry an <img>.
      for (const m of html.matchAll(/<article class="card service"[\s\S]*?<\/article>/g)) {
        expect(m[0], `${file}: service card without a photo`).toMatch(
          /<div class="media"[^>]*><img /
        )
      }
      for (const m of html.matchAll(/<article class="card acard[\s\S]*?<\/article>/g)) {
        expect(m[0], `${file}: article card without a photo`).toMatch(
          /<a class="amedia"[^>]*><img /
        )
      }
    }
  })

  it('service copy matches the latest wording from the clinic', () => {
    const page = (slug: string) => readFileSync(join(dist, 'services', slug, 'index.html'), 'utf8')
    for (const [slug, name] of [
      ['prosthodontics', 'Prosthodontics'],
      ['root-canal', 'Root Canal Treatment'],
      ['cosmetic-dentistry', 'Cosmetic Dentistry'],
      ['dental-hygiene', 'Dental Hygiene'],
      ['pediatric-dentistry', 'Pediatric Dentistry'],
    ]) {
      expect(page(slug)).toContain(`Meet Your Expert and Senior Dentist for ${name}`)
    }
    expect(page('pediatric-dentistry')).toContain('Baby Root Canal')
    const hygiene = page('dental-hygiene')
    expect(hygiene).toContain('Oral Hygiene Guidance')
    expect(hygiene).toContain('Scaling and Root Planing')
    expect(hygiene).not.toContain('Mouth Hygiene Guidance')
    const surgery = page('oral-surgery')
    expect(surgery).toContain('Disimpaction')
    expect(surgery).not.toContain('Disinfection')
    expect(surgery).toContain('Treatment of Serious Pathologies')
    expect(surgery.match(/<details class="faq"/g)?.length).toBe(3)
    const implants = page('dental-implants')
    expect(implants).toContain('Implants After Bone Grafts')
    expect(implants).not.toContain('Implant-Supported Bridges')
    expect(implants).toContain('images/treatments/dental-implants.jpg')
    expect(page('root-canal')).toContain('Treatment to relieve pain and save the tooth.')
  })

  it('home hero headline is "We Care For Your Smile!"', () => {
    const home = readFileSync(join(dist, 'index.html'), 'utf8')
    expect(home).toMatch(/<h1>We Care For Your Smile!<\/h1>/)
    expect(home).not.toMatch(/<h1>Changing Lives One Smile At A Time<\/h1>/)
  })

  it('the old slogan is gone: footer, About and story use "We Care For Your Smile"', () => {
    for (const path of [
      'index.html',
      'about/index.html',
      'contact/index.html',
      'learn/index.html',
    ]) {
      const html = readFileSync(join(dist, path), 'utf8')
      expect(html, path).toContain('We Care For Your Smile')
      expect(html, path).not.toContain('Changing Lives One Smile At A Time')
    }
  })

  it('prosthodontics page shows the before-and-after video in its results grid', () => {
    const html = readFileSync(join(dist, 'services/prosthodontics/index.html'), 'utf8')
    expect(html).toContain('<video')
    expect(html).toContain('videos/prosthodontics-before-after-full.mp4')
    expect(existsSync(join(dist, 'videos/prosthodontics-before-after-full.mp4'))).toBe(true)
    expect(existsSync(join(dist, 'videos/prosthodontics-before-after-full.jpg'))).toBe(true)
  })

  it('every page has the floating WhatsApp button linking to the clinic number', () => {
    for (const file of htmlFiles(dist)) {
      const html = readFileSync(file, 'utf8')
      if (html.includes('http-equiv="refresh"')) continue // a redirect, never shown to visitors
      expect(html, file).toContain('class="wa-float"')
      expect(html, file).toContain('https://wa.me/251912638003?text=')
      expect(html.match(/class="wa-float"/g)?.length, file).toBe(1)
      expect(html, file).toContain('target="_blank" rel="noopener"')
    }
    const css = readFileSync(join(dist, 'assets/style.css'), 'utf8')
    expect(css).toMatch(
      /\.wa-float\s*\{[^}]*position:\s*fixed[^}]*right:\s*20px[^}]*bottom:\s*20px/
    )
  })

  it('uses Telegram in the appointment form (WhatsApp is only the floating button), and shows no unfilled placeholders', () => {
    for (const file of htmlFiles(dist)) {
      const html = readFileSync(file, 'utf8')
      expect(html.replace(/<a class="wa-float"[\s\S]*?<\/a>/, ''), file).not.toMatch(
        /whatsapp|wa\.me/i
      )
      expect(html, file).not.toContain('TODO')
    }
    const contact = readFileSync(join(dist, 'contact/index.html'), 'utf8')
    expect(contact).toContain('data-telegram=')
  })
})
