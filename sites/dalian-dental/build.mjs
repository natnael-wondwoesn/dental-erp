// Builds the Dalian Dental Clinic site into ./dist as plain HTML, CSS and JS.
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
const tg = String(clinic.telegram || '')
  .trim()
  .replace(/^https?:\/\/t\.me\//i, '')
  .replace(/^@/, '')
  .replace(/[^A-Za-z0-9_]/g, '')
const doctorById = Object.fromEntries(c.doctors.map((d) => [d.id, d]))
const base = clinic.domain ? `https://${clinic.domain}` : ''

const pages = [
  ['index.html', 'Home'],
  ['services/', 'Services'],
  ['gallery/', 'Gallery'],
  ['about/', 'About Us'],
  ['blog/', 'Educational'],
  ['contact/', 'Contact'],
]

const toothIcon = `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 3C5 3 3.5 5 3.5 7.5c0 2 .7 3.2 1.2 5 .6 2.1.6 5.5 1.8 8 .5 1 1.6 1 2.1 0 .8-1.700.9-4 2.400-4s1.600 2.300 2.400 4c.5 1 1.600 1 2.100 0 1.200-2.500 1.200-5.900 1.800-8 .5-1.800 1.200-3 1.200-5C20.500 5 19 3 16.500 3c-1.700 0-2.600 1-4.500 1S9.200 3 7.500 3Z"/></svg>`

function rel(depth) {
  return depth === 0 ? './' : '../'.repeat(depth)
}

function contactLinks() {
  const items = []
  if (clinic.phone)
    items.push(`<a href="tel:${esc(digits(clinic.phone))}">${esc(clinic.phone)}</a>`)
  if (clinic.phone2)
    items.push(`<a href="tel:${esc(digits(clinic.phone2))}">${esc(clinic.phone2)}</a>`)
  return items.join(' · ')
}

function bookButtons(depth, extraClass = '') {
  const r = rel(depth)
  const wa = tg
    ? `<a class="btn btn-light ${extraClass}" href="https://t.me/${esc(tg)}" data-track="telegram" rel="noopener">Message us on Telegram</a>`
    : ''
  return `<a class="btn ${extraClass}" href="${r}contact/#book" data-track="book">Book an appointment</a>${wa}`
}

function layout({ title, description, depth, body, path = '' }) {
  const r = rel(depth)
  const nav = pages
    .map(
      ([href, label]) =>
        `<a href="${r}${href}"${path === href ? ' aria-current="page"' : ''}>${label}</a>`
    )
    .join('')
  const top = [
    clinic.address ? esc(clinic.address) : '',
    clinic.hours ? esc(clinic.hours) : '',
    contactLinks(),
  ]
    .filter(Boolean)
    .join(' &nbsp;|&nbsp; ')
  const social = [
    ['Facebook', clinic.facebook],
    ['Instagram', clinic.instagram],
    ['TikTok', clinic.tiktok],
    ['Telegram', tg ? `https://t.me/${tg}` : ''],
  ]
    .filter(([, url]) => url)
    .map(([n, url]) => `<a href="${esc(url)}" rel="noopener">${n}</a>`)
    .join(' ')
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Dentist',
    name: clinic.name,
    ...(base && { url: base }),
    ...(clinic.phone && { telephone: clinic.phone }),
    address: {
      '@type': 'PostalAddress',
      addressLocality: clinic.city,
      ...(clinic.address && { streetAddress: clinic.address }),
    },
  }
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
<link rel="stylesheet" href="${r}assets/fonts.css">
<link rel="stylesheet" href="${r}assets/style.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${top ? `<div class="topbar"><div class="wrap">${top}</div></div>` : ''}
<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="${r}index.html"><span class="brand-mark">${toothIcon}</span><span>${esc(clinic.name)}</span></a>
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
      <div class="brand brand-foot"><span class="brand-mark">${toothIcon}</span><span>${esc(clinic.name)}</span></div>
      <p>${esc(clinic.tagline)}</p>
      ${social ? `<p class="social">${social}</p>` : ''}
    </div>
    <div>
      <h3>Explore</h3>
      ${pages.map(([href, label]) => `<a href="${r}${href}">${label}</a>`).join('')}
    </div>
    <div>
      <h3>Visit us</h3>
      <p>${esc(clinic.city)}</p>
      ${clinic.address ? `<p>${esc(clinic.address)}</p>` : ''}
      ${clinic.hours ? `<p>${esc(clinic.hours)}</p>` : ''}
      ${contactLinks() ? `<p>${contactLinks()}</p>` : ''}
      ${clinic.email ? `<p><a href="mailto:${esc(clinic.email)}">${esc(clinic.email)}</a></p>` : ''}
    </div>
  </div>
  <div class="wrap legal">&copy; ${new Date().getFullYear()} ${esc(clinic.name)}. All rights reserved.</div>
</footer>
<script src="${r}assets/main.js" defer></script>
</body>
</html>
`
}

function doctorCard(d, depth = 0) {
  const initials = d.name
    .replace(/^Dr\.?\s*/, '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
  const photo = d.photo
    ? `<img src="${rel(depth)}${esc(d.photo)}" alt="${esc(d.name)}, ${esc(d.title)}" loading="lazy" width="320" height="320">`
    : `<span class="avatar" aria-hidden="true">${esc(initials)}</span>`
  return `<article class="card doctor">
  <div class="doctor-photo">${photo}</div>
  <h3>${esc(d.name)}</h3>
  <p class="muted">${esc(d.title)}</p>
  ${d.bio ? `<p>${esc(d.bio)}</p>` : ''}
</article>`
}

function serviceCard(s, depth) {
  const r = rel(depth)
  const names = s.doctors.map((id) => doctorById[id]?.name).filter(Boolean)
  return `<article class="card service">
  <div class="icon">${toothIcon}</div>
  <h3>${esc(s.name)}</h3>
  <p>${esc(s.short)}</p>
  <ul class="chips">${s.includes
    .slice(0, 3)
    .map((i) => `<li>${esc(i)}</li>`)
    .join('')}</ul>
  ${names.length ? `<p class="muted small">Specialists: ${esc(names.join(', '))}</p>` : ''}
  <a class="more" href="${r}services/${esc(s.slug)}/">Learn more</a>
</article>`
}

function cta(
  depth,
  heading = 'Ready to book your visit?',
  text = 'Send an appointment request or message us. We will confirm a time with you.'
) {
  return `<section class="cta"><div class="wrap center">
  <h2>${esc(heading)}</h2>
  <p>${esc(text)}</p>
  <div class="btn-row">${bookButtons(depth, 'btn-on-dark')}</div>
</div></section>`
}

function hero({ eyebrow, h1, text, depth, image, alt = '', position = 'center' }) {
  return `<section class="hero"><div class="wrap hero-grid">
  <div>
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1>${esc(h1)}</h1>
    <p class="lead">${esc(text)}</p>
    <div class="btn-row">${bookButtons(depth)}</div>
  </div>
  <div class="hero-art">${image ? `<img src="${rel(depth)}${esc(image)}" alt="${esc(alt)}" width="1000" height="800" style="object-position:${esc(position)}" fetchpriority="high">` : `<div class="art-ph" aria-hidden="true">${toothIcon}</div>`}</div>
</div></section>`
}

const writes = []
function page(path, opts) {
  const depth = path === 'index.html' ? 0 : path.split('/').length - 1
  writes.push([path.endsWith('/') ? `${path}index.html` : path, layout({ ...opts, depth, path })])
}

// Home
page('index.html', {
  title: c.seo.title,
  description: c.seo.description,
  body: `${hero({
    eyebrow: `Dental clinic in ${clinic.city}`,
    h1: `Gentle, specialist dental care in ${clinic.city}`,
    text: `${clinic.name} brings orthodontists, dental surgeons and oral and maxillofacial surgeons together under one roof, so the whole family can be treated in one place.`,
    depth: 0,
    image: 'images/doctors-team.jpg',
    alt: `Doctors at ${clinic.name} in front of the clinic sign`,
    position: 'center 35%',
  })}
<section class="stats"><div class="wrap stat-row">
  <div><strong>${c.services.length}</strong><span>Treatment areas</span></div>
  <div><strong>${c.doctors.length}</strong><span>Doctors and specialists</span></div>
  <div><strong>All ages</strong><span>Children to adults</span></div>
</div></section>
<section class="section"><div class="wrap">
  <p class="eyebrow">Treatments</p>
  <h2>Care for every stage of your smile</h2>
  <div class="grid">${c.services.map((s) => serviceCard(s, 0)).join('')}</div>
</div></section>
<section class="section alt"><div class="wrap split">
  <div>
    <p class="eyebrow">About us</p>
    <h2>${esc(c.mission)}</h2>
    <p>${esc(c.story.replace(/\s*TODO:.*$/, ''))}</p>
    <a class="btn btn-outline" href="./about/">Read more about us</a>
  </div>
  <ul class="ticks">
    ${c.values.map((v) => `<li><strong>${esc(v.title)}.</strong> ${esc(v.text)}</li>`).join('')}
  </ul>
</div></section>
<section class="section"><div class="wrap">
  <p class="eyebrow">Our team</p>
  <h2>Specialists you can talk to</h2>
  <div class="grid grid-doctors">${c.doctors.map((d) => doctorCard(d, 0)).join('')}</div>
</div></section>
${
  c.testimonials.length
    ? `<section class="section alt"><div class="wrap"><p class="eyebrow">Patient voices</p><h2>What patients say</h2><div class="grid">${c.testimonials
        .map(
          (t) =>
            `<blockquote class="card"><p>${esc(t.text)}</p><footer>${esc(t.name)}</footer></blockquote>`
        )
        .join('')}</div></div></section>`
    : ''
}
<section class="section"><div class="wrap narrow">
  <h2>Questions, answered</h2>
  ${c.faq.map((f) => `<details class="faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
</div></section>
${cta(0)}`,
})

// Services index + detail pages
page('services/', {
  title: `Dental Services in Addis Ababa | ${clinic.name}`,
  description: `Braces, implants, root canal, crowns, cosmetic dentistry, hygiene, emergency and children's dental care at ${clinic.name}.`,
  body: `${hero({ eyebrow: 'Services and treatments', h1: `Our ${c.services.length} dental treatment areas`, text: 'Choose a treatment to see what it includes and which doctors provide it.', depth: 1, image: 'images/doctor-gloves.jpg', alt: 'A dentist putting on gloves before treatment', position: 'center 30%' })}
<section class="section"><div class="wrap"><div class="grid">${c.services.map((s) => serviceCard(s, 1)).join('')}</div></div></section>
${cta(1)}`,
})

for (const s of c.services) {
  const docs = s.doctors.map((id) => doctorById[id]).filter(Boolean)
  page(`services/${s.slug}/`, {
    title: `${s.name} in Addis Ababa | ${clinic.name}`,
    description: `${s.short} Book ${s.name.toLowerCase()} at ${clinic.name}, Addis Ababa.`,
    body: `${hero({ eyebrow: 'Treatment', h1: `${s.name} in ${clinic.city}`, text: s.short, depth: 2 })}
<section class="section"><div class="wrap split">
  <div>
    <h2>What is included</h2>
    <ul class="ticks">${s.includes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    <p class="muted small">Your doctor will examine you first and explain the options, the steps and the cost before any treatment starts.</p>
  </div>
  <div>
    <h2>Your specialists</h2>
    <div class="grid grid-doctors">${docs.map((d) => doctorCard(d, 2)).join('')}</div>
  </div>
</div></section>
<section class="section alt"><div class="wrap">
  <h2>Other treatments</h2>
  <div class="grid">${c.services
    .filter((x) => x.slug !== s.slug)
    .slice(0, 3)
    .map((x) => serviceCard(x, 2))
    .join('')}</div>
</div></section>
${cta(2)}`,
  })
}

// Gallery: photos are read from the photos/ folder so adding a picture needs no code change.
const gallerySections = [
  ['before-after', 'Before and after', 'Real treatment results, shown side by side.'],
  [
    'clinic',
    'Our clinic',
    'Reception, waiting area, treatment rooms, equipment and sterilization.',
  ],
  ['patients', 'Our patients', 'Consultations and happy patients.'],
  ['treatments', 'Treatments', 'Our doctors at work.'],
  ['activities', 'Our activities', 'Team, training and events.'],
]
const imageExt = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])
function photosIn(section) {
  const dir = join(here, 'photos', section)
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => imageExt.has(extname(f).toLowerCase()))
        .sort()
    : []
}
function gallerySection([key, title, blurb]) {
  const files = photosIn(key)
  let items
  if (key === 'before-after') {
    const pairs = {}
    for (const f of files) {
      const m = f.match(/^(.*)-(before|after)\./i)
      if (m) (pairs[m[1]] ??= {})[m[2].toLowerCase()] = f
    }
    items = Object.entries(pairs)
      .filter(([, p]) => p.before && p.after)
      .map(
        ([name, p]) =>
          `<figure class="ba"><div><img src="../photos/${key}/${esc(p.before)}" alt="Before: ${esc(name)}" loading="lazy"><span>Before</span></div><div><img src="../photos/${key}/${esc(p.after)}" alt="After: ${esc(name)}" loading="lazy"><span>After</span></div></figure>`
      )
      .join('')
  } else {
    items = files
      .map(
        (f) =>
          `<a class="shot" href="../photos/${key}/${esc(f)}"><img src="../photos/${key}/${esc(f)}" alt="${esc(title)}" loading="lazy"></a>`
      )
      .join('')
  }
  return `<section class="section" id="${key}"><div class="wrap"><h2>${esc(title)}</h2><p class="muted">${esc(blurb)}</p>
${items ? `<div class="shots">${items}</div>` : `<p class="empty">Photos for this section are being added.</p>`}
</div></section>`
}
page('gallery/', {
  title: `Gallery | ${clinic.name}`,
  description: `See our clinic, our team and real treatment results at ${clinic.name} in Addis Ababa.`,
  body: `${hero({ eyebrow: 'Gallery', h1: 'See our clinic and our work', text: 'Real photographs from the clinic, our patients and our treatments.', depth: 1 })}
${gallerySections.map(gallerySection).join('')}
${cta(1, 'Want results like these?')}`,
})

// About
page('about/', {
  title: `About Us | ${clinic.name}`,
  description: `Meet the doctors and learn about the story, mission and values of ${clinic.name} in Addis Ababa.`,
  body: `${hero({ eyebrow: 'About us', h1: `About ${clinic.name}`, text: clinic.tagline, depth: 1 })}
<section class="section"><div class="wrap narrow"><h2>Our story</h2><p>${esc(c.story.replace(/\s*TODO:.*$/, ''))}</p></div></section>
<section class="section tight"><div class="wrap"><figure class="feature"><img src="../images/clinic-team.jpg" alt="The ${esc(clinic.name)} team in front of the clinic sign" width="1600" height="1067" loading="lazy"><figcaption>The ${esc(clinic.name)} team</figcaption></figure></div></section>
<section class="section alt"><div class="wrap">
  <div class="grid">
    <article class="card"><h3>Our mission</h3><p>${esc(c.mission)}</p></article>
    <article class="card"><h3>Our vision</h3><p>${esc(c.vision)}</p></article>
    ${c.values.map((v) => `<article class="card"><h3>${esc(v.title)}</h3><p>${esc(v.text)}</p></article>`).join('')}
  </div>
</div></section>
<section class="section"><div class="wrap"><p class="eyebrow">Meet our team</p><h2>The doctors who will treat you</h2>
  <div class="grid grid-doctors">${c.doctors.map((d) => doctorCard(d, 1)).join('')}</div></div></section>
<section class="section alt"><div class="wrap narrow"><h2>Your visit, step by step</h2>
  <ol class="steps">
    <li><strong>Consultation.</strong> We listen to your concern and examine your teeth.</li>
    <li><strong>Plan.</strong> The doctor explains the diagnosis, the options and the cost.</li>
    <li><strong>Treatment.</strong> Your care is carried out by the right specialist.</li>
    <li><strong>Follow-up.</strong> We check your recovery and advise you on aftercare.</li>
  </ol></div></section>
${cta(1)}`,
})

// Educational / blog
page('blog/', {
  title: `Dental Health Guides | ${clinic.name}`,
  description: `Dental health information from the doctors at ${clinic.name}, Addis Ababa.`,
  body: `${hero({ eyebrow: 'Educational', h1: 'Dental health guides', text: 'Information from our doctors about common dental treatments and care.', depth: 1 })}
<section class="section"><div class="wrap">
${
  c.articles.length
    ? `<div class="grid">${c.articles.map((a) => `<article class="card"><h3>${esc(a.title)}</h3><p>${esc(a.summary)}</p></article>`).join('')}</div>`
    : `<p class="empty">Articles from our doctors are coming soon. In the meantime, each treatment page explains what the treatment includes.</p>
<div class="grid">${c.services.map((s) => serviceCard(s, 1)).join('')}</div>`
}
</div></section>
${cta(1)}`,
})

// Contact + appointment request
const serviceOptions = c.services.map((s) => `<option>${esc(s.name)}</option>`).join('')
page('contact/', {
  title: `Contact and Book an Appointment | ${clinic.name}`,
  description: `Book an appointment or contact ${clinic.name} in ${clinic.city}.`,
  body: `${hero({ eyebrow: 'Contact', h1: 'Book an appointment', text: 'Tell us what you need and when suits you. We will confirm your time with you.', depth: 1 })}
<section class="section" id="book"><div class="wrap split">
  <form id="appointment" class="card form" novalidate data-telegram="${esc(tg)}" data-clinic="${esc(clinic.name)}">
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
  <div>
    <h2>Find us</h2>
    <figure class="feature small-feature"><img src="../images/clinic-building.jpg" alt="The building where ${esc(clinic.name)} is located" width="1200" height="1800" loading="lazy"><figcaption>Our building in ${esc(clinic.city)}</figcaption></figure>
    <ul class="contact-list">
      <li><strong>Location</strong> ${esc(clinic.city)}${clinic.address ? `, ${esc(clinic.address)}` : ''}</li>
      ${clinic.hours ? `<li><strong>Hours</strong> ${esc(clinic.hours)}</li>` : ''}
      ${contactLinks() ? `<li><strong>Phone</strong> ${contactLinks()}</li>` : ''}
      ${tg ? `<li><strong>Telegram</strong> <a href="https://t.me/${esc(tg)}" data-track="telegram" rel="noopener">@${esc(tg)}</a></li>` : ''}
      ${clinic.email ? `<li><strong>Email</strong> <a href="mailto:${esc(clinic.email)}">${esc(clinic.email)}</a></li>` : ''}
    </ul>
    ${clinic.mapEmbedUrl ? `<iframe class="map" title="Map" src="${esc(clinic.mapEmbedUrl)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : ''}
    ${clinic.mapUrl ? `<p><a class="btn btn-outline" href="${esc(clinic.mapUrl)}" rel="noopener">Get directions</a></p>` : ''}
    <p class="muted small">For a dental emergency, please call the clinic directly.</p>
  </div>
</div></section>`,
})

// 404 and crawler files
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
  const urls = writes.map(([p]) => p).filter((p) => p.endsWith('.html') && p !== '404.html')
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
for (const f of ['style.css', 'main.js']) cpSync(join(here, 'assets', f), join(out, 'assets', f))
// House fonts shared by every landing site: Inter (primary) and Poppins (secondary).
cpSync(join(here, '..', '_shared', 'fonts.css'), join(out, 'assets', 'fonts.css'))
cpSync(join(here, '..', '_shared', 'fonts'), join(out, 'assets', 'fonts'), { recursive: true })
if (existsSync(join(here, 'images')))
  cpSync(join(here, 'images'), join(out, 'images'), { recursive: true })
if (existsSync(join(here, 'photos')))
  cpSync(join(here, 'photos'), join(out, 'photos'), { recursive: true })
if (existsSync(join(here, 'public'))) cpSync(join(here, 'public'), out, { recursive: true })
console.log(`Built ${writes.length} files into ${out}`)
