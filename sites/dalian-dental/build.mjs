// Builds the Dalian Speciality Dental Clinic site into ./dist as plain HTML, CSS and JS.
// No framework and no server: the output can be served by any web server.
//
//   node sites/dalian-dental/build.mjs
//
// All text comes from content.json. Details that are empty there are left out of
// the page instead of being filled with made-up values.

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  cpSync,
  existsSync,
  readdirSync,
} from 'node:fs'
import { dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'dist')
const c = JSON.parse(readFileSync(join(here, 'content.json'), 'utf8'))
const clinic = c.clinic

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const digits = (s) => String(s).replace(/[^\d+]/g, '')
// Telegram username without the @ or a t.me/ prefix.
// Digits only, no + sign: the format wa.me links need.
const waNumber = String(clinic.whatsapp || '').replace(/\D/g, '')
const tg = String(clinic.telegram || '')
  .trim()
  .replace(/^https?:\/\/t\.me\//i, '')
  .replace(/^@/, '')
  .replace(/[^A-Za-z0-9_]/g, '')
// The founder is always listed first, wherever doctors appear.
const founderFirst = (a, b) => Number(b === c.founder.doctor) - Number(a === c.founder.doctor)
c.doctors.sort((x, y) => founderFirst(x.id, y.id))
for (const s of c.services) s.doctors.sort(founderFirst)
const doctorById = Object.fromEntries(c.doctors.map((d) => [d.id, d]))
const base = clinic.domain ? `https://${clinic.domain}` : ''
const story = c.story.replace(/\s*TODO:.*$/, '')

const pages = [
  ['index.html', 'Home'],
  ['services/', 'Treatments'],
  ['gallery/', 'Gallery'],
  ['about/', 'About'],
  ['learn/', 'Learn'],
  ['contact/', 'Contact'],
]

// ---- Icons (inline SVG, stroke style) --------------------------------------
const paths = {
  tooth:
    'M7.5 3C5 3 3.5 5 3.5 7.5c0 2 .7 3.2 1.2 5 .6 2.1.6 5.5 1.8 8 .5 1 1.6 1 2.1 0 .8-1.7.9-4 2.4-4s1.6 2.3 2.4 4c.5 1 1.6 1 2.1 0 1.2-2.5 1.2-5.9 1.8-8 .5-1.8 1.2-3 1.2-5C20.5 5 19 3 16.5 3c-1.7 0-2.6 1-4.5 1S9.2 3 7.5 3Z',
  shield:
    'M12 3 4.5 6v5.5c0 4.4 3.1 8.2 7.5 9.5 4.4-1.3 7.5-5.100 7.5-9.500V6L12 3Zm-3 9 2.200 2.200L15.500 9.800',
  heart:
    'M12 20.500s-7.500-4.400-7.500-10A4.500 4.500 0 0 1 12 7.600 4.500 4.500 0 0 1 19.500 10.500c0 5.600-7.500 10-7.500 10Z',
  family:
    'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8.500 1a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5ZM2.500 19c0-3 2.500-5 5.500-5s5.500 2 5.500 5m1.500-.5c.2-2.100 1.700-3.500 3.700-3.500 1.700 0 3.100.9 3.600 2.500',
  phone:
    'M5 4h3l1.500 4-2 1.300a11 11 0 0 0 5.200 5.200L14 12.500l4 1.500v3a2 2 0 0 1-2 2A13 13 0 0 1 3 6a2 2 0 0 1 2-2Z',
  pin: 'M12 21s-6.500-5.600-6.500-11a6.500 6.500 0 0 1 13 0c0 5.400-6.500 11-6.500 11Zm0-8.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13.500V12l3 2',
  mail: 'M4 6h16v12H4V6Zm0 1 8 6 8-6',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  chevron: 'm6 9 6 6 6-6',
  quote:
    'M9 7H6.500A1.500 1.500 0 0 0 5 8.500V12a1.500 1.500 0 0 0 1.500 1.500H9V16a2 2 0 0 1-2 2m10-11h-2.500A1.500 1.500 0 0 0 13 8.500V12a1.500 1.500 0 0 0 1.500 1.500H17V16a2 2 0 0 1-2 2',
  sparkle: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.500 2.500m7 7L18 18M18 6l-2.500 2.500m-7 7L6 18',
  check: 'm5 12.500 4.500 4.500L19 7.500',
}
const ic = (name, extra = '') =>
  `<svg class="i ${extra}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"/></svg>`

// data-r marks an element for the scroll reveal (see assets/main.js).
const rv = (kind = 'up', i = 0) =>
  ` data-r="${kind}"${i ? ` style="--d:${Math.min(i * 90, 540)}ms"` : ''}`

function rel(depth) {
  return depth === 0 ? './' : '../'.repeat(depth)
}

function contactLine(depth) {
  return [
    clinic.phone && `<a href="tel:${esc(digits(clinic.phone))}">${esc(clinic.phone)}</a>`,
    clinic.phone2 && `<a href="tel:${esc(digits(clinic.phone2))}">${esc(clinic.phone2)}</a>`,
  ]
    .filter(Boolean)
    .join('<br>')
}

function heroButtons(depth, { variant = 'dark' } = {}) {
  const r = rel(depth)
  const parts = [
    `<a class="btn btn-white" href="${r}contact/#book" data-track="book">Book / Contact</a>`,
  ]
  if (clinic.phone)
    parts.push(
      `<a class="btn btn-ghost" href="tel:${esc(digits(clinic.phone))}" data-track="phone">${ic('phone')} Call us</a>`
    )
  if (tg)
    parts.push(
      `<a class="btn btn-ghost" href="https://t.me/${esc(tg)}" data-track="telegram" rel="noopener">Telegram</a>`
    )
  parts.push(`<a class="btn btn-ghost" href="${r}services/">Explore treatments</a>`)
  return parts.join('')
}

function layout({ title, description, depth, body, path = '', jsonld = [], scripts = '' }) {
  const r = rel(depth)
  const nav = pages
    .map(
      ([href, label]) =>
        `<a href="${r}${href}"${path === href ? ' aria-current="page"' : ''}>${label}</a>`
    )
    .join('')
  const social = [
    ['Facebook', clinic.facebook],
    ['Instagram', clinic.instagram],
    ['TikTok', clinic.tiktok],
    ['Telegram', tg ? `https://t.me/${tg}` : ''],
  ]
    .filter(([, url]) => url)
    .map(([n, url]) => `<a href="${esc(url)}" rel="noopener">${n}</a>`)
    .join('')
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Dentist',
    name: clinic.name,
    ...(base && { url: base }),
    ...(clinic.phone && { telephone: clinic.phone }),
    ...(clinic.email && { email: clinic.email }),
    address: {
      '@type': 'PostalAddress',
      addressLocality: clinic.city,
      ...(clinic.address && { streetAddress: clinic.address }),
    },
  }
  const footContact = [
    clinic.address && [
      'pin',
      'Address',
      `${esc(clinic.address)}, ${esc(clinic.city)}${clinic.mapUrl ? `<br><a href="${esc(clinic.mapUrl)}" rel="noopener">Get directions</a>` : ''}`,
    ],
    clinic.hours && ['clock', 'Opening hours', esc(clinic.hours)],
    contactLine(depth) && ['phone', 'Phone', contactLine(depth)],
    clinic.email && [
      'mail',
      'Email',
      `<a href="mailto:${esc(clinic.email)}">${esc(clinic.email)}</a>`,
    ],
  ]
    .filter(Boolean)
    .map(
      ([i, label, text]) =>
        `<div><span class="tile">${ic(i)}</span><span><b>${label}</b>${text}</span></div>`
    )
    .join('')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="${esc(clinic.primaryColor)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
${base ? `<meta property="og:image" content="${base}/images/doctors-team.jpg">` : ''}
${base ? `<link rel="canonical" href="${base}/${esc(path === 'index.html' ? '' : path)}">` : ''}
<link rel="preload" href="${r}assets/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${r}assets/fonts/poppins-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="icon" href="${r}images/brand/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="${r}images/brand/apple-icon.png">
<link rel="stylesheet" href="${r}assets/fonts.css">
<link rel="stylesheet" href="${r}assets/style.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
${jsonld.map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n')}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="${r}index.html"><span class="brand-mark"><img src="${r}images/brand/logo-mark.png" alt="" width="40" height="40"></span><span>${esc(clinic.name)}</span></a>
    <button class="menu-btn" aria-expanded="false" aria-controls="nav" aria-label="Open menu"><span></span><span></span><span></span></button>
    <nav id="nav" class="nav" aria-label="Main">${nav}<a class="btn btn-sm" href="${r}contact/#book" data-track="book">Book / Contact</a></nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap foot">
    <div>
      <div class="brand brand-foot"><span class="brand-mark"><img src="${r}images/brand/logo-mark.png" alt="" width="40" height="40"></span><span>${esc(clinic.name)}</span></div>
      <p>We treat you with care. Dental care in ${esc(clinic.area || clinic.city)}${clinic.area ? `, ${esc(clinic.city)}` : ''}.</p>
      <p><strong style="color:#fff">${esc(clinic.tagline)}</strong></p>
      ${social ? `<p class="social">${social}</p>` : ''}
    </div>
    <div>
      <h3>Explore</h3>
      ${pages.map(([href, label]) => `<a class="link" href="${r}${href}">${label}</a>`).join('')}
    </div>
    <div>
      <h3>Treatments</h3>
      ${c.services.map((s) => `<a class="link" href="${r}services/${esc(s.slug)}/">${esc(s.name)}</a>`).join('')}
    </div>
    <div>
      <h3>Contact</h3>
      <div class="foot-contact">${footContact}</div>
    </div>
  </div>
  <div class="wrap legal">&copy; ${new Date().getFullYear()} ${esc(clinic.name)}. All rights reserved.</div>
</footer>
${
  waNumber
    ? `<a class="wa-float" href="https://wa.me/${waNumber}${clinic.whatsappMessage ? `?text=${encodeURIComponent(clinic.whatsappMessage)}` : ''}" target="_blank" rel="noopener" aria-label="Chat with ${esc(clinic.name)} on WhatsApp" data-track="whatsapp"><svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" fill="currentColor"><path d="M16.04 3C9.4 3 4 8.4 4 15.02c0 2.12.55 4.18 1.6 6L4 29l8.13-1.56a12 12 0 0 0 3.9.65h.01C22.68 28.1 28 22.7 28 16.08 28 9.4 22.68 3 16.04 3Zm0 22.1h-.01a10 10 0 0 1-5.1-1.4l-.37-.22-3.77.72.8-3.67-.24-.38a9.9 9.9 0 0 1-1.53-5.3c0-5.5 4.5-10 10.03-10 5.53 0 10.03 4.5 10.03 10.06 0 5.5-4.5 10.19-9.84 10.19Zm5.5-7.5c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.68-1.65-.93-2.26-.25-.6-.5-.5-.68-.5h-.58c-.2 0-.52.07-.8.37-.27.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.1 3.2 5.1 4.5.7.3 1.27.5 1.7.62.72.23 1.37.2 1.88.12.58-.08 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.08-.13-.28-.2-.58-.35Z"/></svg><span class="wa-label">Chat on WhatsApp</span></a>`
    : ''
}
<script src="${r}assets/main.js" defer></script>
${scripts}
</body>
</html>
`
}

// ---- Components -------------------------------------------------------------
function doctorCard(d, depth = 0, i = 0) {
  const initials = d.name
    .replace(/^Dr\.?\s*/, '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
  const photo = d.photo
    ? `<img src="${rel(depth)}${esc(d.photo)}" alt="${esc(d.name)}, ${esc(d.title)}" loading="lazy" width="160" height="160">`
    : `<span class="avatar" aria-hidden="true">${esc(initials)}</span>`
  return `<article class="card doctor"${rv('up', i)}>
  <div class="doctor-photo">${photo}</div>
  <h3>${esc(d.name)}</h3>
  <p class="role">${esc(d.title)}</p>
  ${d.bio ? `<p>${esc(d.bio)}</p>` : ''}
</article>`
}

// On the home page only these cards name their specialists; the others say the care is by an expert and senior dentist.
const namedSpecialists = new Set(['dental-implants', 'orthodontics', 'oral-surgery'])
const mediaTones = [
  'linear-gradient(135deg,#0a4a7c,#1196e8)',
  'linear-gradient(135deg,#0b78bf,#5cc4ff)',
  'linear-gradient(135deg,#0e5f9f,#2aa8f0)',
  'linear-gradient(135deg,#0a5c99,#7ccbff)',
  'linear-gradient(135deg,#083a63,#0b78bf)',
  'linear-gradient(135deg,#2aa8f0,#9ed4f7)',
]
function serviceCard(s, depth, i = 0, homeCard = false) {
  const r = rel(depth)
  const names = s.doctors.map((id) => doctorById[id]?.name).filter(Boolean)
  return `<article class="card service"${rv('up', i)}>
  <div class="media" style="background:${mediaTones[i % mediaTones.length]}">${s.image ? `<img src="${r}${esc(s.image)}" alt="${esc(s.imageAlt || s.name)}" loading="lazy" width="600" height="400">` : ic('tooth')}</div>
  <span class="badge">${ic('sparkle')}</span>
  <div class="body">
    <h3>${esc(s.name)}</h3>
    <p>${esc(s.short)}</p>
    <ul class="chips">${s.includes
      .slice(0, 3)
      .map((x) => `<li>${esc(x)}</li>`)
      .join('')}</ul>
    ${
      (!homeCard || namedSpecialists.has(s.slug)) && names.length
        ? `<p class="muted small">${esc(s.detail?.specialistsLabel || 'Specialists')}: ${esc(names.join(', '))}</p>`
        : homeCard
          ? '<p class="muted small">Expert and senior dentist</p>'
          : ''
    }
    <a class="more" href="${r}services/${esc(s.slug)}/">Learn more ${ic('arrow')}</a>
  </div>
</article>`
}

function ctaPanel(
  depth,
  heading = 'Ready for a smile you feel good about?',
  text = 'Get in touch and our team will help you choose the right first step.',
  label = 'Book / Contact'
) {
  const r = rel(depth)
  return `<section class="cta-section"><div class="wrap"><div class="cta-panel"${rv('zoom')}>
  <h2>${esc(heading)}</h2>
  <p>${esc(text)}</p>
  <div class="btn-row"><a class="btn btn-white" href="${r}contact/#book" data-track="book">${esc(label)}</a>${
    clinic.phone
      ? `<a class="btn btn-ghost" href="tel:${esc(digits(clinic.phone))}" data-track="phone">${ic('phone')} Call us</a>`
      : ''
  }</div>
</div></div></section>`
}

// Big maroon hero on the home page.
function heroHome({ pill, kicker, h1, text, depth, image, alt }) {
  return `<section class="hero">
  <div class="hero-bg"></div><div class="orb orb-a"></div><div class="orb orb-b"></div><span class="dot dot-a"></span><span class="dot dot-b"></span>
  <div class="wrap hero-grid">
    <div class="hero-copy">
      ${pill ? `<p class="pill">${esc(pill)}</p>` : '<span></span>'}
      <p class="kicker">${esc(kicker)}</p>
      <h1>${esc(h1)}</h1>
      <p class="lead">${esc(text)}</p>
      <div class="btn-row">${heroButtons(depth)}</div>
    </div>
    <div class="hero-frame"><img src="${rel(depth)}${esc(image)}" alt="${esc(alt)}" width="1000" height="800" fetchpriority="high"></div>
  </div>
</section>`
}

// Smaller maroon header used on inner pages.
function pageHero({ crumbs, h1, text, depth, image, alt = '', buttons }) {
  const r = rel(depth)
  const trail = [`<a href="${r}index.html">Home</a>`, ...crumbs].join(' / ')
  return `<section class="hero compact">
  <div class="hero-bg"></div><div class="orb orb-a"></div><div class="orb orb-b"></div><span class="dot dot-b"></span>
  <div class="wrap hero-grid${image ? '' : ' solo'}">
    <div class="hero-copy">
      <p class="crumbs">${trail}</p>
      <p class="kicker">${esc(clinic.name)}</p>
      <h1>${esc(h1)}</h1>
      <p class="lead">${esc(text)}</p>
      <div class="btn-row">${buttons || heroButtons(depth)}</div>
    </div>
    ${image ? `<div class="hero-frame"><img src="${r}${esc(image)}" alt="${esc(alt)}" width="1000" height="800" fetchpriority="high"></div>` : ''}
  </div>
</section>`
}

function sectionHead(eyebrow, title, text = '') {
  return `<div class="section-head"${rv()}><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}</div>`
}

function founderStory(depth) {
  const f = c.founder
  const d = doctorById[f.doctor]
  return `<section class="section tinted" id="story"><div class="wrap split">
  <div class="story-photo"${rv('left')}>
    <div class="frame"><img src="${rel(depth)}${esc(f.image)}" alt="${esc(d.name)}, ${esc(d.title)}" width="800" height="1000" loading="lazy"></div>
    <div class="founder-tag"><strong>${esc(d.name)}</strong><span>${esc(d.title)}</span></div>
  </div>
  <div${rv('right')}>
    <p class="eyebrow">Our story</p>
    <h2>Founded by ${esc(d.name)}</h2>
    <p>${esc(story)}</p>
    ${c.storyMotto ? `<p>${esc(c.storyMotto)}</p>` : ''}
    <p class="quote">${ic('quote')} ${esc(f.quote)}</p>
  </div>
</div></section>`
}

function trustRow() {
  return `<section class="trust"><div class="wrap trust-row">${c.stats
    .map((s, i) => {
      const text = `${Number(s.value).toLocaleString('en-US')}${s.suffix || ''}`
      return `<div${rv('up', i)}><strong data-count="${s.value}" data-suffix="${esc(s.suffix || '')}">${text}</strong><span>${esc(s.label)}</span></div>`
    })
    .join('')}</div></section>`
}

function jpegSize(file) {
  try {
    const buf = readFileSync(file)
    let i = 2
    while (i < buf.length) {
      if (buf[i] !== 0xff) return null
      const marker = buf[i + 1]
      const len = buf.readUInt16BE(i + 2)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
      i += 2 + len
    }
  } catch {}
  return null
}
// Real width/height for an image under the site folder (stops layout shift while loading).
function dims(src) {
  const size = jpegSize(join(here, src))
  return size ? ` width="${size.w}" height="${size.h}"` : ''
}
const imageExt = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])
function photosIn(section) {
  const dir = join(here, 'photos', section)
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => imageExt.has(extname(f).toLowerCase()))
        .sort()
    : []
}
// Before/after photos are matched by file name: <case>-before.jpg and <case>-after.jpg.
function beforeAfterPairs() {
  const pairs = {}
  for (const f of photosIn('before-after')) {
    const m = f.match(/^(.*)-(before|after)\./i)
    if (m) (pairs[m[1]] ??= {})[m[2].toLowerCase()] = f
  }
  const meta = Object.fromEntries((c.cases || []).map((x) => [x.id, x]))
  const order = (c.cases || []).map((x) => x.id)
  return Object.entries(pairs)
    .filter(([, p]) => p.before && p.after)
    .map(([name, p]) => ({
      name,
      title: meta[name]?.title || name.replace(/-/g, ' ').replace(/^./, (ch) => ch.toUpperCase()),
      text: meta[name]?.text || '',
      ...p,
    }))
    .sort((x, y) => {
      const i = order.indexOf(x.name)
      const j = order.indexOf(y.name)
      return (i < 0 ? 99 : i) - (j < 0 ? 99 : j)
    })
}
// A treatment result as a case-study card: title, short description, and the
// BEFORE and AFTER photographs (each opens in the lightbox).
function baFigure(pair, prefix, i = 0, extra = '') {
  const half = (file, label) => {
    const src = `photos/before-after/${file}`
    return `<a class="lb ba-half" href="${prefix}${esc(src)}" data-caption="${esc(pair.title)} (${label.toLowerCase()})"><img src="${prefix}${esc(src)}" alt="${label} treatment: ${esc(pair.title.toLowerCase())}" loading="lazy"${dims(src)}><span>${label}</span></a>`
  }
  return `<figure class="ba case${extra}"${rv('up', i % 3)}><div class="ba-pair">${half(pair.before, 'Before')}${half(pair.after, 'After')}</div><figcaption><strong>${esc(pair.title)}</strong>${pair.text ? `<span>${esc(pair.text)}</span>` : ''}</figcaption></figure>`
}

const writes = []
function page(path, opts) {
  const depth = path === 'index.html' ? 0 : path.split('/').length - 1
  writes.push([path.endsWith('/') ? `${path}index.html` : path, layout({ ...opts, depth, path })])
}

const valueIcons = {
  Professionalism: 'check',
  Integrity: 'shield',
  'Patient Safety': 'shield',
  Compassion: 'heart',
  Teamwork: 'family',
  'Continuous Improvement': 'sparkle',
  Trust: 'check',
  Innovation: 'tooth',
}
const mosaic = [
  ['images/clinic-building.jpg', 'Our clinic building', ''],
  ['images/clinic-team.jpg', 'The Dalian team', 'wide'],
  ['photos/treatments/treatment-scene-1.jpg', 'Chairside care', ''],
  ['photos/clinic/treatment-room-window.jpg', 'Treatment room', ''],
]

// ---- Home -------------------------------------------------------------------
page('index.html', {
  title: c.seo.title,
  description: c.seo.description,
  body: `${heroHome({
    pill: clinic.hoursShort,
    kicker: `${clinic.name}${clinic.area ? ` · ${clinic.area}` : ''}`,
    h1: clinic.tagline,
    text: `We treat you with care. Thorough consultations, tailored treatment plans and specialist doctors, all under one roof in ${clinic.city}.`,
    depth: 0,
    image: 'images/doctors-team.jpg',
    alt: `Doctors at ${clinic.name} in front of the clinic sign`,
  })}
<div class="wrap"><div class="feature-card">
  <div class="item"><span class="tile">${ic('shield')}</span><div><h3>Specialist team</h3><p>Doctors including an orthodontist, dental surgeons and oral and maxillofacial surgeons.</p></div></div>
  <div class="item"><span class="tile">${ic('heart')}</span><div><h3>We treat you with care</h3><p>Unhurried consultations and plans built around you.</p></div></div>
  <div class="item"><span class="tile">${ic('family')}</span><div><h3>Care for all ages</h3><p>From children's dentistry to braces, implants and surgery.</p></div></div>
</div></div>
${trustRow()}
<section class="section"><div class="wrap">
  ${sectionHead('Treatments', 'Care for every stage of your smile', 'From a routine clean to specialist procedures, our team covers the treatments most families need.')}
  <div class="grid">${c.services.map((s, i) => serviceCard(s, 0, i % 3, true)).join('')}</div>
</div></section>
${founderStory(0)}
<section class="section"><div class="wrap">
  ${sectionHead('Our team', 'Specialists you can talk to', 'Doctors working together on your care.')}
  <div class="grid grid-doctors">${c.doctors.map((d, i) => doctorCard(d, 0, i)).join('')}</div>
  <p style="margin-top:28px"><a class="btn btn-outline" href="./about/#team">Meet the team</a></p>
</div></section>
<section class="section dark"><div class="wrap">
  ${sectionHead('Our core values', 'What we stand for', 'The principles behind every visit.')}
  <div class="grid values-grid">${c.values
    .map(
      (v, i) =>
        `<div class="glass compact"${rv('up', i % 4)}><span class="tile">${ic(valueIcons[v.title] || 'check')}</span><h3>${esc(v.title)}</h3></div>`
    )
    .join('')}</div>
</div></section>
${
  c.testimonials.length
    ? `<section class="section"><div class="wrap">${sectionHead('Patient voices', 'What patients say', c.testimonials.some((t) => t.placeholder) ? 'Placeholder testimonials. Replace with real, consented patient feedback before launch.' : '')}</div><div class="marquee" aria-label="Patient testimonials"><div class="marquee-track">${[
        ...c.testimonials,
        ...c.testimonials,
      ]
        .map(
          (t) =>
            `<blockquote class="card">${ic('quote')}<p>${esc(t.text)}</p><footer>${esc(t.name)}</footer></blockquote>`
        )
        .join('')}</div></div></section>`
    : ''
}
<section class="section"><div class="wrap">
  ${sectionHead('Inside the clinic', 'A look at Dalian', 'Our building, our team and our doctors.')}
  <div class="mosaic">${mosaic
    .map(
      ([src, label, cls], i) =>
        `<a class="tile-photo ${cls}"${rv('zoom', i)} href="./gallery/"><img src="./${src}" alt="${esc(label)}" loading="lazy"><span class="chip">${esc(label)}</span></a>`
    )
    .join('')}</div>
</div></section>
<section class="section tinted"><div class="wrap faq-wrap">
  <div${rv('left')}>
    <p class="eyebrow">FAQ</p>
    <h2>Common questions</h2>
    <p>Quick answers before your first visit.</p>
    <a class="btn btn-outline" href="./contact/#book">Ask us anything</a>
  </div>
  <div class="faq-card"${rv('right')}>${c.faq
    .map(
      (f) =>
        `<details class="faq"><summary>${esc(f.q)} ${ic('chevron')}</summary><p>${esc(f.a)}</p></details>`
    )
    .join('')}</div>
</div></section>
${ctaPanel(0)}`,
})

// ---- Treatments -------------------------------------------------------------
page('services/', {
  title: `Dental Services in Addis Ababa | ${clinic.name}`,
  description: `Braces, implants, root canal, crowns, cosmetic dentistry, hygiene, emergency and children's dental care at ${clinic.name}.`,
  body: `${pageHero({ crumbs: ['Treatments'], h1: `Our ${c.services.length} dental treatment areas`, text: 'Choose a treatment to see what it includes and which doctors provide it.', depth: 1, image: 'images/doctor-gloves.jpg', alt: 'A dentist putting on gloves before treatment' })}
<section class="section"><div class="wrap"><div class="grid">${c.services.map((s, i) => serviceCard(s, 1, i % 3)).join('')}</div></div></section>
${ctaPanel(1)}`,
})

function specialistCard(d, depth, i = 0) {
  const initials = d.name
    .replace(/^Dr\.?\s*/, '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
  const media = d.photo
    ? `<div class="g-doc-photo"><img src="${rel(depth)}${esc(d.photo)}" alt="${esc(d.name)}, ${esc(d.title)}" loading="lazy"${dims(d.photo)}></div>`
    : `<div class="g-doc-photo g-doc-empty" aria-hidden="true"><span>${esc(initials)}</span></div>`
  return `<article class="card g-doc"${rv('up', i)}>${media}<div class="g-doc-info"><p class="spec-role">${esc(d.title)}</p><h3>${esc(d.name)}</h3>${d.bio ? `<p class="bio">${esc(d.bio)}</p>` : ''}</div></article>`
}

for (const s of c.services) {
  const dt = s.detail
  const docs = s.doctors.map((id) => doctorById[id]).filter(Boolean)
  const cases = (s.results || [])
    .map((name) => beforeAfterPairs().find((p) => p.name === name))
    .filter(Boolean)
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: dt.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
  const crumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      ['Home', ''],
      ['Treatments', 'services/'],
      [s.name, `services/${s.slug}/`],
    ].map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      ...(base && { item: `${base}/${path}` }),
    })),
  }
  const bookHref = `../../contact/?service=${encodeURIComponent(s.name)}#book`
  const buttons = `<a class="btn btn-white" href="${bookHref}" data-track="book">${esc(dt.bookLabel)}</a>${
    clinic.phone
      ? `<a class="btn btn-ghost" href="tel:${esc(digits(clinic.phone))}" data-track="phone">${ic('phone')} Call us</a>`
      : ''
  }`
  page(`services/${s.slug}/`, {
    title: dt.metaTitle,
    description: dt.metaDescription,
    jsonld: [faqLd, crumbLd],
    body: `${pageHero({ crumbs: ['<a href="../">Treatments</a>', esc(s.name)], h1: `${s.name} in ${clinic.city}`, text: s.short, depth: 2, image: s.hero || s.image, alt: s.heroAlt || s.imageAlt || '', buttons })}
<section class="section" id="options"><div class="wrap">
  ${sectionHead('Specialized options', 'Available Treatment Subcategories', `The ${s.name.toLowerCase()} options we offer.`)}
  <div class="sub-grid">${dt.subcategories
    .map(
      (x, i) =>
        `<article class="sub-card"${rv('up', i % 2)}><span class="sub-num">${i + 1}</span><div><h3>${esc(x.name)}</h3><p>${esc(x.text)}</p></div></article>`
    )
    .join('')}</div>
</div></section>
<section class="section tinted" id="benefits"><div class="wrap">
  ${sectionHead('Clinical outcomes', `Benefits of ${s.name}`)}
  <div class="benefit-grid">${dt.benefits
    .map(
      (x, i) => `<div class="benefit"${rv('up', i % 3)}>${ic('check')}<span>${esc(x)}</span></div>`
    )
    .join('')}</div>
</div></section>
<section class="section" id="specialists"><div class="wrap">
  ${sectionHead('Assigned medical staff', dt.specialistsHeading || `Meet Your Specialists for ${s.name}`, 'The doctors who provide this treatment at Dalian Speciality Dental Clinic.')}
  <div class="spec-grid">${docs.map((d, i) => specialistCard(d, 2, i)).join('')}</div>
</div></section>
<section class="section tinted" id="faq"><div class="wrap narrow">
  ${sectionHead('Patient guidance', `Frequently Asked Questions About ${s.name}`)}
  <div class="faq-card"${rv('up')}>${dt.faq
    .map(
      (f) =>
        `<details class="faq"><summary>${esc(f.q)} ${ic('chevron')}</summary><p>${esc(f.a)}</p></details>`
    )
    .join('')}</div>
</div></section>
<section class="section" id="results"><div class="wrap">
  ${sectionHead('Real results', `${s.name}: Before & After`, cases.length ? `Photographs of real ${clinic.name} patients.` : '')}
  ${
    cases.length
      ? `<div class="case-grid">${cases.map((pair, i) => baFigure(pair, '../../', i)).join('')}</div>`
      : `<div class="empty">Before-and-after photographs for ${esc(s.name.toLowerCase())} will be added here. In the meantime, see our <a href="../../gallery/#results">other treatment results</a> or ask us about this treatment at your consultation.</div>`
  }
</div></section>
<section class="section tinted"><div class="wrap">
  ${sectionHead('More care', 'Other treatments')}
  <div class="grid">${c.services
    .filter((x) => x.slug !== s.slug)
    .slice(0, 3)
    .map((x, i) => serviceCard(x, 2, i))
    .join('')}</div>
</div></section>
${ctaPanel(2, `Ready to book your ${s.name.toLowerCase()} appointment?`, 'Send us your details and we will confirm a time that suits you.', dt.bookLabel).replace('href="../../contact/#book"', `href="${bookHref}"`)}`,
  })
}

// ---- Gallery ----------------------------------------------------------------
const galleryTabs = [
  ['all', 'All'],
  ['doctors', 'Our Doctors'],
  ['clinic', 'Our Clinic'],
  ['results', 'Treatment Results'],
]
const RESULTS_VISIBLE = 6

function galleryFig(photo, i = 0) {
  return `<figure class="g-fig"${rv('up', i % 4)}><a class="lb" href="../${esc(photo.src)}" data-caption="${esc(photo.caption)}"><img src="../${esc(photo.src)}" alt="${esc(photo.caption)}" loading="lazy"${dims(photo.src)}></a><figcaption>${esc(photo.caption)}</figcaption></figure>`
}

function galleryDoctor(d, i) {
  const initials = d.name
    .replace(/^Dr\.?\s*/, '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
  const media = d.photo
    ? `<a class="lb g-doc-photo" href="../${esc(d.photo)}" data-caption="${esc(d.name)}, ${esc(d.title)}"><img src="../${esc(d.photo)}" alt="${esc(d.name)}, ${esc(d.title)}" loading="lazy"${dims(d.photo)}></a>`
    : `<div class="g-doc-photo g-doc-empty" aria-hidden="true"><span>${esc(initials)}</span></div>`
  return `<article class="card g-doc"${rv('up', i % 3)}>${media}<div class="g-doc-info"><h3>${esc(d.name)}</h3><p>${esc(d.title)}</p></div></article>`
}

function galleryPage() {
  const groups = c.gallery.clinic.filter((g) => g.photos.length)
  const cases = beforeAfterPairs()
  const buttons = `<a class="btn btn-white" href="../contact/#book" data-track="book">Book an Appointment</a><a class="btn btn-ghost" href="../services/">Explore Treatments</a>`
  return `${pageHero({
    crumbs: ['Gallery'],
    h1: 'See Our Clinic. Meet Our Team. Discover Our Work.',
    text: 'Explore our dental clinic, meet our team, and discover examples of our dental treatments.',
    depth: 1,
    image: 'images/doctors-team.jpg',
    alt: `Doctors at ${clinic.name} in front of the clinic sign`,
    buttons,
  })}
<nav class="g-nav" aria-label="Gallery categories"><div class="wrap g-nav-in">${galleryTabs
    .map(
      ([key, label], i) =>
        `<a href="#${key === 'all' ? 'gallery' : key}" data-filter="${key}"${i === 0 ? ' aria-current="true"' : ''}>${label}</a>`
    )
    .join('')}</div></nav>
<div id="gallery">
<section class="section g-section" id="doctors" data-cat="doctors"><div class="wrap">
  ${sectionHead('Our doctors', 'The doctors who look after you', 'Specialists in orthodontics, prosthodontics, surgery and family dentistry.')}
  <div class="g-docs">${c.doctors.map(galleryDoctor).join('')}</div>
  ${
    c.gallery.team.length
      ? `<h3 class="g-group-title">Our team at the clinic</h3><div class="g-grid g-grid-3">${c.gallery.team.map(galleryFig).join('')}</div>`
      : ''
  }
</div></section>
<section class="section tinted g-section" id="clinic" data-cat="clinic"><div class="wrap">
  ${sectionHead('Our clinic', 'A look inside Dalian', 'Treatment rooms, equipment and the building you will visit.')}
  ${groups
    .map(
      (g) =>
        `<div class="g-group" id="clinic-${g.key}"><h3 class="g-group-title">${esc(g.title)}</h3><div class="g-grid g-grid-4">${g.photos.map(galleryFig).join('')}</div></div>`
    )
    .join('')}
</div></section>
<section class="section g-section" id="results" data-cat="results"><div class="wrap">
  ${sectionHead('Treatment results', 'Before and after', 'Real results from our patients, shown as before and after photographs.')}
  <div class="case-grid">${cases.map((pair, i) => baFigure(pair, '../', i, i >= RESULTS_VISIBLE ? ' is-extra' : '')).join('')}</div>
  ${cases.length > RESULTS_VISIBLE ? `<p class="center" style="margin-top:28px"><button class="btn btn-outline" type="button" data-more-results>View all results</button></p>` : ''}
</div></section>
</div>
${ctaPanel(1, 'Ready to Take Care of Your Smile?', 'Our team is ready to help you take the next step towards better oral health.', 'Book an Appointment')}`
}
page('gallery/', {
  title: `Gallery | ${clinic.name}`,
  description: `See our clinic, meet our team and discover examples of our dental treatments at ${clinic.name} in Addis Ababa.`,
  body: galleryPage(),
})

// ---- About ------------------------------------------------------------------
page('about/', {
  title: `About Us | ${clinic.name}`,
  description: `Meet the doctors and learn about the story, mission and values of ${clinic.name} in Addis Ababa.`,
  body: `${pageHero({ crumbs: ['About'], h1: `About ${clinic.name}`, text: clinic.tagline, depth: 1, image: 'images/clinic-team.jpg', alt: `The ${clinic.name} team in front of the clinic sign` })}
${founderStory(1)}
<section class="section"><div class="wrap">
  ${sectionHead('About us', 'What guides our care')}
  <div class="grid about-cards">
    <article class="card about-card"${rv('up', 0)}><h3>Our Mission</h3><p>${esc(c.mission)}</p></article>
    <article class="card about-card"${rv('up', 1)}><h3>Our Vision</h3><p>${esc(c.vision)}</p></article>
    <article class="card about-card"${rv('up', 2)}><h3>Our Core Values</h3><ul class="values-list">${c.values.map((v) => `<li>${esc(v.title)}</li>`).join('')}</ul></article>
  </div>
</div></section>
<section class="section tinted" id="team"><div class="wrap">
  ${sectionHead('Meet our team', 'The doctors who will treat you')}
  <div class="grid grid-doctors">${c.doctors.map((d, i) => doctorCard(d, 1, i)).join('')}</div>
</div></section>
<section class="section dark"><div class="wrap">
  ${sectionHead('Your visit', 'Step by step')}
  <div class="grid">${[
    ['Consultation', 'We listen to your concern and examine your teeth.'],
    ['Plan', 'The doctor explains the diagnosis, the options and the cost.'],
    ['Treatment', 'Your care is carried out by the right specialist.'],
    ['Follow-up', 'We check your recovery and advise you on aftercare.'],
  ]
    .map(
      ([t, x], i) =>
        `<div class="glass"${rv('up', i)}><span class="tile">${ic(['check', 'sparkle', 'tooth', 'heart'][i])}</span><h3>${i + 1}. ${t}</h3><p>${x}</p></div>`
    )
    .join('')}</div>
</div></section>
${ctaPanel(1)}`,
})

// ---- Learn: SEO education hub and article pages ---------------------------------
// Articles live in articles/*.md: a JSON header, then a small Markdown body. Adding a file
// there publishes a new article (own URL, listed on the hub, added to the sitemap).
const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
const categoryOrder = [
  'Tooth Pain & Sensitivity',
  'Gum Health',
  'Dental Treatments',
  'Cosmetic Dentistry',
  'Oral Hygiene & Prevention',
  "Children's Dental Health",
  'Dental Implants',
  'Braces & Teeth Alignment',
  'Dental Emergencies',
]
const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
function renderMarkdown(src) {
  const html = []
  const toc = []
  let list = null
  let ordered = false
  const close = () => {
    if (list) html.push(ordered ? '</ol>' : '</ul>')
    list = null
  }
  let para = []
  const flush = () => {
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`)
    para = []
  }
  for (const raw of src.split('\n')) {
    const line = raw.trimEnd()
    if (/^## /.test(line)) {
      flush()
      close()
      const text = line.slice(3)
      const id = slugify(text)
      toc.push({ id, text })
      html.push(`<h2 id="${id}">${esc(text)}</h2>`)
    } else if (/^### /.test(line)) {
      flush()
      close()
      html.push(`<h3>${esc(line.slice(4))}</h3>`)
    } else if (/^- /.test(line)) {
      flush()
      if (!list || ordered) {
        close()
        list = []
        ordered = false
        html.push('<ul>')
      }
      html.push(`<li>${inline(line.slice(2))}</li>`)
    } else if (/^\d+\. /.test(line)) {
      flush()
      if (!list || !ordered) {
        close()
        list = []
        ordered = true
        html.push('<ol>')
      }
      html.push(`<li>${inline(line.replace(/^\d+\. /, ''))}</li>`)
    } else if (line.trim() === '') {
      flush()
      close()
    } else {
      para.push(line.trim())
    }
  }
  flush()
  close()
  return { html: html.join('\n'), toc }
}
const articlesDir = join(here, 'articles')
const articles = existsSync(articlesDir)
  ? readdirSync(articlesDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const raw = readFileSync(join(articlesDir, f), 'utf8')
        const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
        const meta = JSON.parse(m[1])
        const { html, toc } = renderMarkdown(m[2])
        const words =
          m[2].split(/\s+/).length +
          (meta.faq || []).reduce((n, q) => n + q.a.split(/\s+/).length, 0)
        return {
          ...meta,
          html,
          toc,
          minutes: Math.max(1, Math.round(words / 200)),
          catSlug: slugify(meta.category),
        }
      })
      .sort(
        (x, y) =>
          (y.published || '').localeCompare(x.published || '') || x.title.localeCompare(y.title)
      )
  : []
const articleBySlug = Object.fromEntries(articles.map((a) => [a.slug, a]))
const usedCategories = categoryOrder.filter((n) => articles.some((a) => a.category === n))
const longDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

function articleCard(a, depth, i = 0, extra = '') {
  const r = rel(depth)
  const media = a.image
    ? `<img src="${r}${esc(a.image)}" alt="${esc(a.imageAlt || a.title)}" loading="lazy" width="600" height="400">`
    : `<span class="ph">${ic('tooth')}</span>`
  const text = `${a.title} ${a.description} ${a.keywords || ''} ${a.category}`.toLowerCase()
  return `<article class="card acard${extra}"${rv('up', i % 3)} data-cat="${a.catSlug}" data-text="${esc(text)}">
  <a class="amedia" href="${r}learn/${esc(a.slug)}/" tabindex="-1" aria-hidden="true">${media}</a>
  <div class="abody">
    <p class="achip">${esc(a.category)}</p>
    <h3><a href="${r}learn/${esc(a.slug)}/">${esc(a.title)}</a></h3>
    <p>${esc(a.description)}</p>
    <p class="ameta">${a.minutes} min read</p>
    <a class="more" href="${r}learn/${esc(a.slug)}/">Read article ${ic('arrow')}</a>
  </div>
</article>`
}

const featuredSlugs = [
  'bleeding-gums-causes-and-treatment',
  'why-do-my-teeth-hurt-with-cold-drinks',
  'brushing-flossing-and-preventing-cavities',
]
const popularTopics = ['Bleeding gums', 'Tooth sensitivity', 'Root canal', 'Whitening', 'Braces']
const commonQuestions = [
  [
    'What causes bleeding gums?',
    'Most often plaque and tartar building up along the gum line and inflaming the gums.',
    'bleeding-gums-causes-and-treatment',
  ],
  [
    'Why do my teeth hurt when drinking cold water?',
    'Often exposed dentine, but a cavity or crack can feel the same, so it is worth having it checked.',
    'why-do-my-teeth-hurt-with-cold-drinks',
  ],
  [
    'How often should I visit a dentist?',
    'It depends on your risk of dental disease. Guidance says the interval should be set for each person.',
    'how-often-should-i-see-a-dentist',
  ],
  [
    'Is teeth whitening safe?',
    'For most healthy adults, when done properly. Sensitivity and gum irritation are the main side effects.',
    'is-teeth-whitening-safe',
  ],
  [
    'What should I do if a tooth is knocked out?',
    'Pick it up by the crown, rinse gently and put it back if you can, then see a dentist immediately.',
    'knocked-out-tooth-first-aid',
  ],
]

function learnCta(depth) {
  const r = rel(depth)
  return `<section class="cta-section"><div class="wrap"><div class="cta-panel"${rv('zoom')}>
  <h2>Ready to Take Care of Your Smile?</h2>
  <p>Book a visit and our doctors will examine you, explain the options and answer your questions.</p>
  <div class="btn-row"><a class="btn btn-white" href="${r}contact/#book" data-track="book">Book an Appointment</a><a class="btn btn-ghost" href="${r}contact/" data-track="contact">Contact Our Clinic</a></div>
</div></div></section>`
}

page('learn/', {
  title: `Dental Health Guides and Advice | ${clinic.name}`,
  description: `Evidence-based dental health information: tooth pain, gum health, treatments, cosmetic dentistry, oral hygiene, children's teeth, implants and braces, from ${clinic.name} in Addis Ababa.`,
  scripts: '<script src="../assets/learn.js" defer></script>',
  jsonld: [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Dental health guides',
      ...(base && { url: `${base}/learn/` }),
      hasPart: articles.map((a) => ({
        '@type': 'Article',
        headline: a.title,
        ...(base && { url: `${base}/learn/${a.slug}/` }),
      })),
    },
  ],
  body: `<section class="hero compact">
  <div class="hero-bg"></div><div class="orb orb-a"></div><div class="orb orb-b"></div><span class="dot dot-b"></span>
  <div class="wrap hero-grid solo">
    <div class="hero-copy">
      <p class="crumbs"><a href="../index.html">Home</a> / Learn</p>
      <p class="kicker">Dental education</p>
      <h1>Your Guide to Better Oral Health</h1>
      <p class="lead">Clear, evidence-based answers to common dental questions, with sources, from the team at ${esc(clinic.name)}.</p>
      <form class="learn-search" role="search" id="learn-search-form">
        <label class="sr" for="learn-search">Search dental health topics</label>
        <input id="learn-search" type="search" placeholder="Search dental health topics..." autocomplete="off">
        <button class="btn btn-white" type="submit">Search</button>
      </form>
      <div class="pop"><span>Popular:</span>${popularTopics.map((t) => `<a href="?q=${encodeURIComponent(t.toLowerCase())}#latest" data-q="${esc(t.toLowerCase())}">${esc(t)}</a>`).join('')}</div>
    </div>
  </div>
</section>
<section class="section" id="topics"><div class="wrap">
  ${sectionHead('Browse by topic', 'Find what you are looking for')}
  <div class="grid topics">${usedCategories
    .map((n, i) => {
      const count = articles.filter((a) => a.category === n).length
      return `<a class="card topic"${rv('up', i % 4)} href="?cat=${slugify(n)}#latest" data-cat="${slugify(n)}"><span class="tile">${ic(['sparkle', 'heart', 'tooth', 'sparkle', 'check', 'family', 'shield', 'tooth', 'phone'][i % 9])}</span><strong>${esc(n)}</strong><small>${count} article${count === 1 ? '' : 's'}</small></a>`
    })
    .join('')}</div>
</div></section>
<section class="section tinted"><div class="wrap">
  ${sectionHead('Featured', 'Start here')}
  <div class="grid">${featuredSlugs
    .map((s) => articleBySlug[s])
    .filter(Boolean)
    .map((a, i) => articleCard(a, 1, i, ' featured'))
    .join('')}</div>
</div></section>
<section class="section" id="latest"><div class="wrap">
  ${sectionHead('Latest articles', 'All dental articles')}
  <div class="chips-row" id="learn-chips" role="group" aria-label="Filter by topic"><button type="button" class="chip-btn active" data-cat="all">All</button>${usedCategories.map((n) => `<button type="button" class="chip-btn" data-cat="${slugify(n)}">${esc(n)}</button>`).join('')}</div>
  <p class="result-count" id="learn-count" role="status" aria-live="polite"></p>
  <div class="grid" id="learn-grid">${articles.map((a, i) => articleCard(a, 1, i)).join('')}</div>
  <p class="empty" id="learn-empty" hidden>No articles match your search. Try another word or choose All.</p>
  <nav class="pager" id="learn-pager" aria-label="Article pages"></nav>
</div></section>
<section class="section tinted"><div class="wrap faq-wrap">
  <div${rv('left')}>
    <p class="eyebrow">Common dental questions</p>
    <h2>Quick answers</h2>
    <p>Short answers, with a link to the full article behind each one.</p>
  </div>
  <div class="faq-card"${rv('right')}>${commonQuestions
    .map(
      ([q, a, slug]) =>
        `<details class="faq"><summary>${esc(q)} ${ic('chevron')}</summary><p>${esc(a)} <a href="./${slug}/">Read the full article</a>.</p></details>`
    )
    .join('')}</div>
</div></section>
${learnCta(1)}`,
})

for (const a of articles) {
  const related = (a.related || []).map((s) => articleBySlug[s]).filter(Boolean)
  const url = base ? `${base}/learn/${a.slug}/` : ''
  const service = c.services.find((s) => (a.serviceLinks || []).includes(s.slug))
  page(`learn/${a.slug}/`, {
    title: `${a.title} | ${clinic.name}`,
    description: a.description,
    jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: a.title,
        description: a.description,
        datePublished: a.published,
        dateModified: a.published,
        author: { '@type': 'Organization', name: a.author },
        publisher: { '@type': 'Organization', name: clinic.name },
        ...(url && { mainEntityOfPage: url }),
        ...(base && a.image && { image: `${base}/${a.image}` }),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', ...(base && { item: `${base}/` }) },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Learn',
            ...(base && { item: `${base}/learn/` }),
          },
          { '@type': 'ListItem', position: 3, name: a.title, ...(url && { item: url }) },
        ],
      },
      ...((a.faq || []).length
        ? [
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: a.faq.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            },
          ]
        : []),
    ],
    body: `<section class="hero compact article-hero">
  <div class="hero-bg"></div><div class="orb orb-a"></div><span class="dot dot-b"></span>
  <div class="wrap">
    <div class="hero-copy narrow-hero">
      <p class="crumbs"><a href="../../index.html">Home</a> / <a href="../">Learn</a> / ${esc(a.category)}</p>
      <h1>${esc(a.title)}</h1>
      <p class="lead">${esc(a.intro)}</p>
      <p class="byline"><span>By ${esc(a.author)}</span><span>Published ${longDate(a.published)}</span><span>${a.minutes} min read</span></p>
    </div>
  </div>
</section>
<section class="section article"><div class="wrap article-grid">
  <aside class="toc" aria-label="Table of contents"${rv('left')}>
    <p class="eyebrow">In this article</p>
    <ol>${a.toc.map((t) => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}${(a.faq || []).length ? '<li><a href="#faq">Frequently asked questions</a></li>' : ''}<li><a href="#sources">Sources</a></li></ol>
  </aside>
  <article class="prose">
    ${a.image ? `<figure class="featured-img"><img src="../../${esc(a.image)}" alt="${esc(a.imageAlt || a.title)}" width="900" height="600" fetchpriority="high"></figure>` : ''}
    <p class="notice"><strong>Medical review:</strong> ${esc(a.reviewStatus)} This page is general information, not a diagnosis. Please see a dentist about your own teeth.</p>
    ${a.html}
    ${(a.faq || []).length ? `<h2 id="faq">Frequently asked questions</h2><div class="faq-card inline">${a.faq.map((f) => `<details class="faq"><summary>${esc(f.q)} ${ic('chevron')}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>` : ''}
    <h2 id="sources">Sources</h2>
    <ol class="sources">${a.sources
      .map(
        (s) =>
          `<li>${s.url ? `<a href="${esc(s.url)}" rel="noopener">${esc(s.label)}</a>` : esc(s.label)}</li>`
      )
      .join('')}</ol>
    <p class="muted small">Information can change as new research is published. Last reviewed ${longDate(a.published)}.</p>
  </article>
</div></section>
${
  related.length
    ? `<section class="section tinted"><div class="wrap">${sectionHead('Keep reading', 'Related articles')}<div class="grid">${related.map((x, i) => articleCard(x, 2, i)).join('')}</div></div></section>`
    : ''
}
${learnCta(2)}`,
  })
}

// The old /blog/ address now points at /learn/.
writes.push([
  'blog/index.html',
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Moved to Learn</title><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=../learn/"><link rel="canonical" href="${base ? `${base}/learn/` : '../learn/'}"></head><body><h1>Moved to Learn</h1><p>This page has moved to <a href="../learn/">Learn</a>.</p></body></html>\n`,
])

// ---- Contact + appointment request -----------------------------------------
const serviceOptions = c.services.map((s) => `<option>${esc(s.name)}</option>`).join('')
page('contact/', {
  title: `Contact and Book an Appointment | ${clinic.name}`,
  description: `Book an appointment or contact ${clinic.name} in ${clinic.city}.`,
  body: `${pageHero({ crumbs: ['Contact'], h1: 'Book an appointment', text: 'Tell us what you need and when suits you. We will confirm your time with you.', depth: 1 })}
<section class="section" id="book"><div class="wrap split" style="align-items:start">
  <form id="appointment" class="card form" novalidate data-telegram="${esc(tg)}" data-clinic="${esc(clinic.name)}"${rv('left')}>
    <h2>Appointment request</h2>
    <label>Full name<input name="name" required autocomplete="name"></label>
    <label>Phone number<input name="phone" required inputmode="tel" autocomplete="tel"></label>
    <label>Email (optional)<input name="email" type="email" autocomplete="email"></label>
    <div class="two">
      <label>Preferred date<input name="date" type="date"></label>
      <label>Preferred time<input name="time" type="time"></label>
    </div>
    <label>Service needed<select name="service"><option value="">Not sure yet</option>${serviceOptions}</select></label>
    <label>Message<textarea name="message" rows="4"></textarea></label>
    <p class="honeypot"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label></p>
    <button class="btn" type="submit">${tg ? 'Send request on Telegram' : 'Prepare my request'}</button>
    <p class="form-msg" role="status" aria-live="polite"></p>
  </form>
  <div${rv('right')}>
    <p class="eyebrow">Find us</p>
    <h2>Visit the clinic</h2>
    <figure class="feature small-feature"><img src="../images/clinic-building.jpg" alt="The building where ${esc(clinic.name)} is located" width="1200" height="1800" loading="lazy"><figcaption>Our building in ${esc(clinic.area || clinic.city)}</figcaption></figure>
    <ul class="contact-list">
      <li><span class="tile">${ic('pin')}</span><span><strong>Location</strong>${esc(clinic.address ? `${clinic.address}, ` : '')}${esc(clinic.city)}</span></li>
      ${clinic.hours ? `<li><span class="tile">${ic('clock')}</span><span><strong>Hours</strong>${esc(clinic.hours)}</span></li>` : ''}
      ${contactLine(1) ? `<li><span class="tile">${ic('phone')}</span><span><strong>Phone</strong>${contactLine(1)}</span></li>` : ''}
      ${tg ? `<li><span class="tile">${ic('arrow')}</span><span><strong>Telegram</strong><a href="https://t.me/${esc(tg)}" data-track="telegram" rel="noopener">@${esc(tg)}</a></span></li>` : ''}
      ${clinic.email ? `<li><span class="tile">${ic('mail')}</span><span><strong>Email</strong><a href="mailto:${esc(clinic.email)}">${esc(clinic.email)}</a></span></li>` : ''}
    </ul>
    ${clinic.mapEmbedUrl ? `<iframe class="map" title="Map" src="${esc(clinic.mapEmbedUrl)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : ''}
    ${clinic.mapUrl ? `<p><a class="btn btn-outline" href="${esc(clinic.mapUrl)}" rel="noopener" data-track="directions">Get directions</a></p>` : ''}
    <p class="muted small">For a dental emergency, please call the clinic directly.</p>
  </div>
</div></section>`,
})

// ---- 404 and crawler files --------------------------------------------------
writes.push([
  '404.html',
  layout({
    title: `Page not found | ${clinic.name}`,
    description: 'This page could not be found.',
    depth: 0,
    path: '404.html',
    body: `<section class="section"><div class="wrap narrow center"><h1>Page not found</h1><p>The page you are looking for does not exist.</p><a class="btn" href="./index.html">Back to home</a></div></section>`,
  }),
])
writes.push([
  'robots.txt',
  `User-agent: *\nAllow: /\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`,
])
if (base) {
  const urls = writes
    .map(([p]) => p)
    .filter((p) => p.endsWith('.html') && p !== '404.html' && p !== 'blog/index.html')
  writes.push([
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((p) => `  <url><loc>${base}/${p.replace(/index\.html$/, '')}</loc></url>`)
      .join('\n')}\n</urlset>\n`,
  ])
}

rmSync(out, { recursive: true, force: true })
for (const [path, html] of writes) {
  const file = join(out, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
}
mkdirSync(join(out, 'assets'), { recursive: true })
for (const f of ['style.css', 'main.js', 'learn.js'])
  cpSync(join(here, 'assets', f), join(out, 'assets', f))
// House fonts shared by every landing site: Inter (primary) and Poppins (secondary).
cpSync(join(here, '..', '_shared', 'fonts.css'), join(out, 'assets', 'fonts.css'))
cpSync(join(here, '..', '_shared', 'fonts'), join(out, 'assets', 'fonts'), { recursive: true })
if (existsSync(join(here, 'images')))
  cpSync(join(here, 'images'), join(out, 'images'), { recursive: true })
if (existsSync(join(here, 'photos')))
  cpSync(join(here, 'photos'), join(out, 'photos'), { recursive: true })
if (existsSync(join(here, 'public'))) cpSync(join(here, 'public'), out, { recursive: true })
console.log(`Built ${writes.length} files into ${out}`)
