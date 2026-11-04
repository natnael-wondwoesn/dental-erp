import { expect, test } from '@playwright/test'

test.describe('Control-managed account creation', () => {
  test('clinic login does not advertise signup', async ({ page }) => {
    await page.goto('/login')

    await expect(
      page.getByRole('link', { name: /sign up|register|create.*workspace|create account/i })
    ).toHaveCount(0)
  })

  test('clinic signup page and API are concealed', async ({ page, request }) => {
    const pageResponse = await page.goto('/signup')
    const apiResponse = await request.post('/api/public/signup', {
      data: {
        hospitalName: 'Blocked Clinic',
        adminName: 'Blocked User',
        phone: '0911234567',
        password: 'not-created',
      },
    })

    expect(pageResponse?.status()).toBe(404)
    expect(apiResponse.status()).toBe(404)
  })
})
