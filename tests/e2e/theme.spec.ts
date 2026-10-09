import { expect, test } from '@playwright/test'

for (const preference of ['light', 'dark', 'system'] as const) {
  test(`hydrates the ${preference} theme and persists toggles`, async ({ page }) => {
    const hydrationWarnings: string[] = []
    page.on('console', (message) => {
      if (/hydration mismatch/i.test(message.text())) hydrationWarnings.push(message.text())
    })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.addInitScript((preference) => {
      // Initialize once so reload tests the preference saved by the toggle.
      if (sessionStorage.getItem('theme-test-initialized')) return
      sessionStorage.setItem('theme-test-initialized', 'true')
      if (preference === 'system') localStorage.removeItem('dropzone-theme')
      else localStorage.setItem('dropzone-theme', preference)
    }, preference)
    await page.goto('/')

    const isDark = preference !== 'light'
    const toggle = page.locator('.theme-toggle:visible')
    await expect(toggle).toHaveAttribute('aria-pressed', String(isDark))
    await expect(toggle).toHaveAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`)
    await expect(toggle).toHaveAttribute('title', `Switch to ${isDark ? 'light' : 'dark'} theme`)
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(isDark)
    // Hydration must not persist the light server snapshot over the preference.
    expect(await page.evaluate(() => localStorage.getItem('dropzone-theme'))).toBe(preference === 'system' ? null : preference)

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', String(!isDark))
    expect(await page.evaluate(() => localStorage.getItem('dropzone-theme'))).toBe(isDark ? 'light' : 'dark')
    await page.reload()
    await expect(toggle).toHaveAttribute('aria-pressed', String(!isDark))
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(!isDark)
    expect(hydrationWarnings).toEqual([])
  })
}
