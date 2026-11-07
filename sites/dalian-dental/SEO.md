# Dalian site: SEO notes

SEO-ready build following the "Main Website Development Objective: SEO Optimization" brief. SEO-ready does not guarantee rankings; results depend on content, competition and time.

## Keyword map (one primary focus per page)

| Page                                 | Focus                                                        | Where it lives                                             |
| ------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Home                                 | dental clinic in Addis Ababa / Bole, private dental clinic   | `content.json` > `seo.pages.home`                          |
| Treatments index                     | dental treatments in Addis Ababa, dentist                    | `seo.pages.services`                                       |
| Orthodontics                         | braces, orthodontist, teeth alignment                        | `services[].detail.seoTitle / h1 / lead / metaDescription` |
| Dental Implants                      | dental implants in Addis Ababa                               | same                                                       |
| Cosmetic Dentistry                   | Hollywood smile, teeth whitening, cosmetic dentistry         | same                                                       |
| Oral Surgery                         | jaw correction surgery, oral surgeon                         | same                                                       |
| Root Canal                           | root canal treatment                                         | same                                                       |
| Dental Hygiene                       | professional dental cleaning                                 | same                                                       |
| Emergency, Pediatric, Prosthodontics | emergency dentist, children's dentist, crowns and dentures   | same                                                       |
| Gallery, About, Contact              | smile makeover results, dental specialists, book appointment | `seo.pages.*`                                              |

Keywords are placed in title, meta description, H1 and the lead paragraph only, with natural wording (no stuffing).

## What the build does

- Unique `<title>` and meta description per page, one H1, ordered headings.
- JSON-LD: `Dentist` (name, address, phone, geo, hours, areaServed, founder, offer catalog), `WebSite`, `Service`, `FAQPage`, `BreadcrumbList`, `Article`.
- Open Graph and Twitter cards with a share image.
- `sitemap.xml` with `lastmod`, `robots.txt`, clean folder URLs, custom 404.
- Images are WebP with real `width` / `height`, descriptive `alt`, and lazy loading. CSS is minified; JS is small and deferred.
- Internal links: treatment pages list related guides; guides link back to their treatment (`serviceLinks` in each article's front matter); footer and "other treatments" links.
- Optional GA4 with IP anonymisation, plus `contact_click` events for call, WhatsApp, email and Telegram buttons.

## Still needed from the clinic (left empty on purpose)

- `clinic.ga4Id` (GA4 measurement ID, `G-XXXXXXXXXX`).
- `clinic.gscVerification` (Search Console HTML-tag token).
- After deploy: add the property in Google Search Console, submit `https://dalian.dental.clinic-cms.cc/sitemap.xml`, and validate structured data with Google's Rich Results Test.
- Confirm name, address and phone numbers are identical on Google Business Profile, social pages and this site.
- Validate the keyword list with real search volume (for example Search Console after a few weeks).
- Cache headers for `/assets` and `/images` can be set in the Caddy snippet for extra Core Web Vitals gains.
