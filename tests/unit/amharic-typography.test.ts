import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('Amharic typography', () => {
  const layout = fs.readFileSync(path.resolve(__dirname, '../../app/layout.tsx'), 'utf8')
  const css = fs.readFileSync(path.resolve(__dirname, '../../app/globals.css'), 'utf8')

  it('loads the same Latin and Ethiopic font families as Clinic-CMS', () => {
    expect(layout).toContain('@fontsource/manrope/400.css')
    expect(layout).toContain('@fontsource/manrope/800.css')
    expect(layout).toContain('@fontsource-variable/noto-sans-ethiopic/wght.css')
    expect(css).toContain("'Manrope', 'Noto Sans Ethiopic Variable'")
  })

  it('removes Latin tracking and gives Amharic headings safe leading', () => {
    expect(css).toContain("html[lang='am'] [class*='tracking-']")
    expect(css).toMatch(/html\[lang='am'\] h1,[\s\S]*line-height: 1\.34/)
    expect(css).toMatch(/html\[lang='am'\] \.uppercase \{[\s\S]*text-transform: none/)
  })
})
