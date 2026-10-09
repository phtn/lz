import { expect, test } from '@playwright/test'

test('metal logo fills only the glyph, animates, and pauses for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const logo = page.locator('.landing-metal-logo')
  const canvas = logo.locator('canvas')
  await expect(logo).toHaveAttribute('data-ready', 'true')
  const pixels = await canvas.evaluate((element: HTMLCanvasElement) => {
    const { data } = element.getContext('2d')!.getImageData(0, 0, element.width, element.height)
    const alpha = Array.from(data).filter((_, index) => index % 4 === 3)
    return { corner: alpha[0], painted: alpha.filter((value) => value > 0).length, total: alpha.length }
  })
  expect(pixels.corner).toBe(0)
  expect(pixels.painted).toBeGreaterThan(0)
  expect(pixels.painted).toBeLessThan(pixels.total / 2)
  const firstFrame = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(firstFrame)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const pausedFrames = await canvas.evaluate(async (element: HTMLCanvasElement) => {
    const wait = () => new Promise<void>((resolve) => {
      let frames = 0
      const tick = () => { if (++frames >= 15) resolve(); else requestAnimationFrame(tick) }
      requestAnimationFrame(tick)
    })
    await wait()
    const before = element.toDataURL()
    await wait()
    return [before, element.toDataURL()]
  })
  expect(pausedFrames[0]).toBe(pausedFrames[1])
  const currentTheme = await page.locator('html').evaluate((element) => element.classList.contains('dark'))
  await page.getByRole('button', { name: `Switch to ${currentTheme ? 'light' : 'dark'} mode` }).click()
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(pausedFrames[1])
  await expect(page.locator('main[role=alert]')).toHaveCount(0)
  await page.screenshot({ path: 'test-results/metal-text-logo.png' })
})

test('keeps the cloud visible when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'OffscreenCanvas', { value: undefined, configurable: true })
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (this: HTMLCanvasElement, type: string, options?: unknown) {
        if (type === 'webgl') return null
        return Reflect.apply(original, this, [type, options])
      }
    })
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled()
  await expect(page.locator('.landing-metal-logo .metal-text-fallback')).toHaveText('☁')
  await expect(page.locator('.landing-metal-logo .metal-text-fallback')).toHaveCSS('opacity', '1')
  await expect(page.locator('.landing-metal-logo canvas')).toHaveCSS('opacity', '0')
  await expect(page.locator('main[role=alert]')).toHaveCount(0)
})
