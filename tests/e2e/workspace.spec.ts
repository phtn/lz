import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
const publicKey = [...readFileSync('.env', 'utf8').split('\n'), ...readFileSync('.env.local', 'utf8').split('\n')]
  .findLast((line) => line.startsWith('PUBLIC_FIREBASE_API_KEY='))?.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '')
const image = readFileSync('public/icons/512.png')
const files = [
  { id: 'image-one', name: 'travel-photo.png', size: image.length, mimeType: 'image/png', category: 'Images', kind: 'Image', confidence: 74, excerpt: 'A photo from the trip.', createdAt: '2026-10-04T00:00:00Z', url: '/fixtures/photo.png' },
  { id: 'invoice-one', name: 'October-invoice.txt', size: 500, mimeType: 'text/plain', category: 'Invoices', kind: 'Invoice', confidence: 93, excerpt: 'Invoice number 123', createdAt: '2026-10-03T00:00:00Z', url: '/fixtures/invoice.txt' }
]
async function mockWorkspace(page: Page, signedIn = true) {
  await page.route('**/identitytoolkit.googleapis.com/**', (route) => route.fulfill({ json: { users: [{ localId: 'ui-test', email: 'test@example.test', displayName: 'Alex', emailVerified: true, providerUserInfo: [] }] } }))
  await page.route('**/securetoken.googleapis.com/**', (route) => route.fulfill({ json: { access_token: 'ui-test', expires_in: '3600', refresh_token: 'ui-test', token_type: 'Bearer', user_id: 'ui-test', project_id: 'ui-test' } }))
  await page.addInitScript(({ key, signedIn }) => {
    if (!localStorage.getItem('dropzone-theme')) localStorage.setItem('dropzone-theme', 'light')
    if (signedIn && key) localStorage.setItem(`firebase:authUser:${key}:[DEFAULT]`, JSON.stringify({
      uid: 'ui-test', email: 'test@example.test', emailVerified: true, displayName: 'Alex', isAnonymous: false, providerData: [],
      stsTokenManager: { refreshToken: 'test-token', accessToken: 'test-token', expirationTime: Date.now() + 86400000 }, apiKey: key, appName: '[DEFAULT]'
    }))
  }, { key: publicKey, signedIn })
  let library = signedIn ? files.map((file) => ({ ...file })) : []
  let failNextUpload = false
  await page.route('**/fixtures/photo.png', (route) => route.fulfill({ contentType: 'image/png', body: image }))
  await page.route('**/api/files**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'POST') {
      if (failNextUpload) { failNextUpload = false; return route.fulfill({ status: 503, json: { error: 'Connection interrupted. Please retry.' } }) }
      const uploaded = { ...files[1], id: 'uploaded-file', name: 'new-invoice.txt', url: '/fixtures/invoice.txt' }
      library = [uploaded, ...library]
      await new Promise((resolve) => setTimeout(resolve, 650))
      return route.fulfill({ status: 201, json: { file: uploaded } })
    }
    if (request.method() === 'DELETE') {
      library = library.filter((file) => file.id !== url.pathname.split('/').pop())
      return route.fulfill({ json: { ok: true } })
    }
    if (request.method() === 'PATCH') {
      const id = url.pathname.split('/').pop()
      const category = request.postDataJSON().category
      library = library.map((file) => file.id === id ? { ...file, category } : file)
      return route.fulfill({ json: { file: library.find((file) => file.id === id) } })
    }
    if (url.searchParams.get('metadata') === '1') {
      const file = library.find((file) => file.id === url.pathname.split('/').pop())
      return route.fulfill({ json: { file: { ...file, method: 'On-device OCR', text: 'Invoice number 123\nPayment due 2026-10-31\nTotal 250.00', ocrConfidence: 92 } } })
    }
    return route.fulfill({ json: { files: library } })
  })
  return { failNext: () => { failNextUpload = true } }
}

test('signed-in desktop library, preview controls, extracted text, and folder correction', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 960 })
  await mockWorkspace(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Preview travel-photo/ })).toBeVisible()
  await expect(page.locator('.topbar')).toHaveCSS('height', '64px')
  await expect(page.locator('.topbar svg path').first()).toBeAttached()
  await page.screenshot({ path: 'test-results/desktop-light.png' })
  await page.getByRole('button', { name: /Preview travel-photo/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.locator('.preview-image')).toBeVisible()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(page.locator('.zoom-value')).toHaveText('125%')
  await page.getByRole('button', { name: 'Rotate image clockwise' }).click()
  await expect(page.locator('.preview-image')).toHaveCSS('transform', /matrix/)
  await page.getByRole('button', { name: 'Fit', exact: true }).click()
  await expect(page.locator('.zoom-value')).toHaveText('100%')
  const stage = await page.locator('.image-stage').boundingBox()
  await page.mouse.move(stage!.x + stage!.width / 2, stage!.y + stage!.height / 2)
  await page.mouse.down()
  await page.mouse.move(stage!.x + stage!.width / 2 + 40, stage!.y + stage!.height / 2 + 20)
  await page.mouse.up()
  await expect(page.locator('.preview-image')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 40, 20)')
  await page.getByRole('tab', { name: 'Extracted text' }).click()
  await expect(page.locator('pre')).toContainText('Payment due')
  await page.getByRole('button', { name: 'Copy text', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Move file to folder' }).selectOption('Travel')
  await expect(page.locator('.preview-insights .category-pill')).toContainText('Travel')
  await page.screenshot({ path: 'test-results/desktop-preview.png' })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(errors).toEqual([])
})

test('mobile layouts in both themes stay within the viewport and preview remains usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockWorkspace(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Preview travel-photo/ })).toBeVisible()
  for (const dark of [false, true]) {
    if (dark) {
      await page.getByRole('button', { name: 'Switch to dark mode' }).click()
      await expect(page.locator('html')).toHaveClass(/dark/)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await page.locator('.workspace-main').evaluate((element) => { element.scrollTop = 0 })
    await page.screenshot({ path: `test-results/mobile-${dark ? 'dark' : 'light'}.png`, animations: 'disabled' })
    await page.getByRole('button', { name: /Preview travel-photo/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await page.getByRole('dialog').evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(390)
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await page.screenshot({ path: `test-results/mobile-preview-${dark ? 'dark' : 'light'}.png` })
    await page.getByRole('button', { name: 'Close file preview' }).click()
  }
  await page.reload()
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
})

test('refresh is cancellable and signing out clears account files immediately', async ({ page }) => {
  await mockWorkspace(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Preview travel-photo/ })).toBeVisible()
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/api/files', async (route) => {
    await pending
    await route.fulfill({ json: { files } }).catch(() => {})
  })
  const request = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/files')
  await page.getByRole('button', { name: 'Refresh library' }).click()
  await request
  await expect(page.getByRole('button', { name: 'Refresh library' })).toBeDisabled()
  const cancelled = page.waitForEvent('requestfailed', (request) => new URL(request.url()).pathname === '/api/files')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await cancelled
  release()
  await expect(page.getByRole('button', { name: /Preview travel-photo/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  await expect(page.locator('.empty-library')).toBeVisible()
  await expect(page.locator('.folder-link')).toHaveCount(28)
  await expect(page.getByRole('combobox', { name: 'Choose a smart folder', includeHidden: true }).locator('option')).toHaveCount(29)
})

test('all folders are available for palette review, including empty categories', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await mockWorkspace(page)
  await page.goto('/')
  await expect(page.locator('.folder-link')).toHaveCount(28)
  await page.locator('.sidebar-folders').getByRole('button', { name: /Invoices/ }).click()
  await page.getByRole('button', { name: /Preview October-invoice/ }).click()
  // Classification destinations must remain available even when the folder is empty.
  await page.getByRole('combobox', { name: 'Move file to folder' }).selectOption('Travel')
  await expect(page.locator('.preview-insights .category-pill')).toContainText('Travel')
  await page.getByRole('button', { name: 'Close file preview' }).click()
  await expect(page.getByRole('heading', { name: /Invoices 0/ })).toBeVisible()
  await expect(page.locator('.sidebar-folders').getByRole('button', { name: /Invoices/ })).toBeVisible()
  await page.locator('.sidebar-folders').getByRole('button', { name: /^Personal records/ }).click()
  await expect(page.locator('.sidebar-folders').getByRole('button', { name: /Travel/ })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  const folders = page.getByRole('combobox', { name: 'Choose a smart folder' })
  await expect(folders.locator('option')).toHaveCount(29)
  await expect(folders.locator('option[value=Invoices]')).toHaveText('Invoices (0)')
  await expect(folders.locator('option[value=Travel]')).toHaveText('Travel (1)')
  await folders.selectOption('All')
  for (const name of ['October-invoice', 'travel-photo']) {
    await page.getByRole('button', { name: new RegExp(`Preview ${name}`) }).click()
    await page.getByRole('button', { name: 'Delete file', exact: true }).click()
    await page.getByRole('button', { name: 'Delete file', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
  await expect(page.getByRole('heading', { name: /All files 0/ })).toBeVisible()
  await expect(folders.locator('option')).toHaveCount(29)
  await expect(page.locator('.folder-link')).toHaveCount(28)
})

test('business dark theme has readable text and action contrast on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await mockWorkspace(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Preview travel-photo/ })).toBeVisible()
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  const ratios = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const luminance = (color: string) => {
      // Launcher uses OKLCH/Lab colors, so let the browser convert to sRGB.
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 1, 1)
      const channels = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map((value) => {
        const channel = value / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }
    const contrast = (text: string, background: string) => {
      const values = [luminance(text), luminance(background)].sort((a, b) => b - a)
      return (values[0] + 0.05) / (values[1] + 0.05)
    }
    const body = getComputedStyle(document.body)
    const muted = getComputedStyle(document.querySelector('.drop-copy p')!)
    const button = getComputedStyle(document.querySelector('.topbar-upload')!)
    return [contrast(body.color, body.backgroundColor), contrast(muted.color, body.backgroundColor), contrast(button.color, button.backgroundColor)]
  })
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5)
  await page.screenshot({ path: 'test-results/desktop-dark.png', animations: 'disabled' })
})

test('desktop sidebar collapses, resizes, and remembers its width without losing search', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await mockWorkspace(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Preview travel-photo/ })).toBeVisible()
  const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' })
  const search = page.getByRole('searchbox', { name: 'Search your files' })
  await search.fill('October')
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(sidebar).toHaveCSS('width', '64px')
  await expect(search).toHaveValue('October')
  await expect(page.getByRole('button', { name: /Preview October-invoice/ })).toBeVisible()
  await page.screenshot({ path: 'test-results/desktop-compact.png', animations: 'disabled' })
  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await expect(sidebar).toHaveCSS('width', '200px')
  const separator = page.getByRole('separator', { name: 'Resize sidebar' })
  const bounds = (await separator.boundingBox())!
  await page.mouse.move(bounds.x, bounds.y + 200)
  await page.mouse.down()
  await page.mouse.move(260, bounds.y + 200)
  await page.mouse.up()
  await expect(sidebar).toHaveCSS('width', '260px')
  await page.reload()
  await expect(sidebar).toHaveCSS('width', '260px')
  await separator.focus()
  await page.keyboard.press('Home')
  await expect(sidebar).toHaveCSS('width', '64px')
  await page.keyboard.press('ArrowRight')
  await expect(sidebar).toHaveCSS('width', '200px')
})

test('branched folders fold, follow library filters, and stay collapsed in compact navigation', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 960 })
  await mockWorkspace(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Preview travel-photo/ })).toBeVisible()
  const sidebar = page.locator('.sidebar-folders')
  const finance = sidebar.getByRole('button', { name: /^Finance & admin/ })
  const personal = sidebar.getByRole('button', { name: /^Personal records/ })
  const creative = sidebar.getByRole('button', { name: /^Creative & media/ })
  await expect(finance).toHaveAttribute('aria-expanded', 'true')
  await expect(personal).toHaveAttribute('aria-expanded', 'false')
  await finance.click()
  await expect(finance).toHaveAttribute('aria-expanded', 'false')
  await expect(sidebar.locator('.folder-link').filter({ hasText: 'Invoices' })).toHaveAttribute('tabindex', '-1')
  await page.locator('.filter-chips').getByRole('button', { name: 'Travel', exact: true }).click()
  await expect(personal).toHaveAttribute('aria-expanded', 'true')
  await expect(sidebar.getByRole('button', { name: /^Travel/ })).toHaveAttribute('aria-current', 'page')
  await expect(finance).toHaveAttribute('aria-expanded', 'false')
  await creative.focus()
  await page.keyboard.press('Enter')
  await expect(creative).toHaveAttribute('aria-expanded', 'true')
  await sidebar.getByRole('button', { name: /^Images/ }).click()
  await expect(page.getByRole('heading', { name: /Images 1/ })).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/')
  await page.screenshot({ path: 'test-results/desktop-branched-light.png', animations: 'disabled' })
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  const compactCreative = sidebar.getByRole('button', { name: 'Creative & media', exact: true })
  await expect(sidebar.locator('.folder-link')).toHaveCount(0)
  await expect(sidebar.getByRole('button')).toHaveCount(8)
  await expect(compactCreative).toHaveAttribute('aria-current', 'page')
  await compactCreative.hover()
  await expect(page.getByRole('tooltip')).toContainText('Creative & media')
  await expect(compactCreative).toHaveAttribute('aria-describedby', await page.getByRole('tooltip').getAttribute('id') as string)
  await expect(sidebar.locator('.folder-link')).toHaveCount(0)
  await sidebar.getByRole('button', { name: 'All files', exact: true }).click()
  await expect(page.getByRole('heading', { name: /All files 2/ })).toBeVisible()
  await page.locator('.filter-chips').getByRole('button', { name: 'Invoices', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Invoices 1/ })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Workspace sidebar' })).toHaveCSS('width', '64px')
  await expect(sidebar.locator('.folder-link')).toHaveCount(0)
  await expect(sidebar.getByRole('button', { name: 'Finance & admin', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.screenshot({ path: 'test-results/desktop-compact-groups.png', animations: 'disabled' })
  await page.getByRole('button', { name: 'Expand sidebar' }).click()
  await expect(finance).toHaveAttribute('aria-expanded', 'true')
  await expect(sidebar.getByRole('button', { name: /^Invoices/ })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await compactCreative.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('complementary', { name: 'Workspace sidebar' })).toHaveCSS('width', '200px')
  await expect(creative).toHaveAttribute('aria-expanded', 'true')
  await expect(creative).toBeFocused()
  await expect(page.getByRole('heading', { name: /Invoices 1/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('mobile sidebar navigates, traps focus, dismisses, and survives switching layouts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockWorkspace(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Preview travel-photo/ })).toBeVisible()
  const trigger = page.getByRole('button', { name: 'Open navigation' })
  const drawer = page.getByRole('dialog', { name: 'DropZone' })
  const openNavigation = async () => {
    await trigger.click()
    await expect(drawer).toBeVisible()
    await expect(drawer).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
  }
  await openNavigation()
  await page.keyboard.press('Shift+Tab')
  expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  await page.screenshot({ path: 'test-results/mobile-navigation-light.png', animations: 'disabled' })
  await drawer.getByRole('button', { name: /Invoices/ }).click()
  await expect(drawer).not.toBeVisible()
  await expect(page.getByRole('heading', { name: /Invoices 1/ })).toBeVisible()
  await expect(trigger).toBeFocused()
  await openNavigation()
  await drawer.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.screenshot({ path: 'test-results/mobile-navigation-dark.png', animations: 'disabled' })
  await page.keyboard.press('Escape')
  await expect(drawer).not.toBeVisible()
  await openNavigation()
  await page.mouse.click(16, 300)
  await expect(drawer).not.toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await openNavigation()
  await page.setViewportSize({ width: 1024, height: 768 })
  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()
  await expect(drawer).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Search your files' }).fill('invoice')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('searchbox', { name: 'Search your files' })).toHaveValue('invoice')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
})

test('uploads retain completion, can be reopened, and recover after an error', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const mocked = await mockWorkspace(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  mocked.failNext()
  await page.locator('input[type=file]').setInputFiles({ name: 'new-invoice.txt', mimeType: 'text/plain', buffer: Buffer.from('INVOICE NUMBER 456 BILL TO ACME PAYMENT DUE TOTAL 250') })
  await expect(page.locator('.queue-panel')).toBeVisible()
  await expect(page.getByRole('button', { name: /Retry new-invoice/ })).toBeVisible()
  await page.getByRole('button', { name: /Retry new-invoice/ }).click()
  await expect(page.locator('.queue-panel')).toContainText('All filed. All ready.')
  await expect(page.locator('.queue-item')).toContainText('Sorted, filed & ready to view')
  await page.screenshot({ path: 'test-results/mobile-upload-complete.png' })
  await page.getByRole('button', { name: 'Minimize upload activity' }).click()
  await expect(page.locator('.queue-dock')).toContainText('1 file sorted & ready to view')
  await page.locator('.queue-dock').click()
  await page.getByRole('button', { name: 'View', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close file preview' }).click()
  await page.locator('.queue-dock').click()
  await page.getByRole('button', { name: 'Clear completed' }).click()
  await expect(page.locator('.queue-item')).toHaveCount(0)
  await page.getByRole('button', { name: 'Minimize upload activity' }).click()
})

test('small phones and tablets have reachable search, categories, and theme controls', async ({ page }) => {
  await mockWorkspace(page, false)
  await page.goto('/')
  for (const width of [320, 360, 574, 575, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await expect(page.getByRole('searchbox', { name: 'Search your files' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible()
    if (width < 575) {
      const trigger = page.getByRole('button', { name: 'Open navigation' })
      await expect(trigger).toBeVisible()
      const bounds = (await trigger.boundingBox())!
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
    }
  }
  await page.setViewportSize({ width: 844, height: 390 })
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible()
  await expect(page.locator('.topbar')).toHaveCSS('height', '64px')
})

test('recognizes a real image with the browser OCR worker', async ({ page }) => {
  test.setTimeout(90000)
  await mockWorkspace(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Preview travel-photo/ })).toBeVisible()
  let extracted: FormData | undefined
  await page.route('**/api/files', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    const request = route.request()
    extracted = await new Request(request.url(), { method: 'POST', headers: { 'content-type': request.headers()['content-type'] }, body: request.postDataBuffer()! }).formData()
    return route.fulfill({ status: 201, json: { file: { ...files[0], id: 'ocr-real', name: 'scanned-document.png', category: extracted.get('category'), excerpt: extracted.get('excerpt') } } })
  })
  const imageData = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1500; canvas.height = 1000
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1500, 1000)
    ctx.fillStyle = 'black'; ctx.font = '48px Arial'
    for (const [index, line] of ['INVOICE NUMBER 12345', 'BILL TO ACME CORPORATION', 'PAYMENT DUE OCTOBER 31', 'SUBTOTAL 250.00', 'TOTAL 275.00'].entries()) ctx.fillText(line, 100, 150 + index * 120)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.locator('input[type=file]').setInputFiles({ name: 'scanned-document.png', mimeType: 'image/png', buffer: Buffer.from(imageData, 'base64') })
  await expect(page.locator('.queue-panel')).toContainText('All filed. All ready.', { timeout: 75000 })
  expect(extracted?.get('method')).toBe('On-device OCR')
  expect(extracted?.get('thumbnail')).toBeInstanceOf(File)
  expect(String(extracted?.get('text'))).toContain('12345')
  expect(Number(extracted?.get('ocrConfidence'))).toBeGreaterThan(70)
  expect(extracted?.get('category')).toBe('Invoices')
})

function mixedPdf(jpeg: Buffer) {
  const text = 'BT /F1 16 Tf 40 740 Td (This typed cover page contains enough readable text to skip OCR.) Tj 0 -30 Td (The next page is a scanned invoice and must still be read.) Tj ET'
  const stream = (content: string) => `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
  const bodies: (string | Buffer)[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
    stream(text),
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /XObject << /Im0 8 0 R >> >> /Contents 6 0 R >>',
    stream('q 600 0 0 400 0 200 cm /Im0 Do Q'),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1500 /Height 1000 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, Buffer.from('\nendstream')])
  ]
  const parts = [Buffer.from('%PDF-1.4\n')]
  const offsets = [0]
  let length = parts[0].length
  for (const [i, body] of bodies.entries()) {
    offsets.push(length)
    const object = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), typeof body === 'string' ? Buffer.from(body) : body, Buffer.from('\nendobj\n')])
    parts.push(object); length += object.length
  }
  parts.push(Buffer.from(`xref\n0 9\n0000000000 65535 f \n${offsets.slice(1).map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n${length}\n%%EOF`))
  return Buffer.concat(parts)
}

test('reads a scanned page after a text page and previews the complete PDF', async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 390, height: 844 })
  await mockWorkspace(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Preview travel-photo/ })).toBeVisible()
  const jpeg = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1500; canvas.height = 1000
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1500, 1000)
    ctx.fillStyle = 'black'; ctx.font = '48px Arial'
    for (const [index, line] of ['INVOICE NUMBER 12345', 'BILL TO ACME CORPORATION', 'PAYMENT DUE OCTOBER 31', 'SUBTOTAL 250.00', 'TOTAL 275.00'].entries()) ctx.fillText(line, 100, 150 + index * 120)
    return canvas.toDataURL('image/jpeg', 0.95).split(',')[1]
  })
  const pdf = mixedPdf(Buffer.from(jpeg, 'base64'))
  const stored = { ...files[1], id: 'pdf-real', name: 'mixed-pages.pdf', mimeType: 'application/pdf', url: '/fixtures/mixed.pdf' }
  let extracted: FormData | undefined
  await page.route('**/fixtures/mixed.pdf', (route) => route.fulfill({ contentType: 'application/pdf', body: pdf }))
  await page.route('**/api/files**', async (route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      extracted = await new Request(request.url(), { method: 'POST', headers: { 'content-type': request.headers()['content-type'] }, body: request.postDataBuffer()! }).formData()
      return route.fulfill({ status: 201, json: { file: stored } })
    }
    if (new URL(request.url()).searchParams.get('metadata') === '1') return route.fulfill({ json: { file: stored } })
    return route.fallback()
  })
  await page.locator('input[type=file]').setInputFiles({ name: 'mixed-pages.pdf', mimeType: 'application/pdf', buffer: pdf })
  await expect(page.locator('.queue-panel')).toContainText('All filed. All ready.', { timeout: 75000 })
  expect(extracted?.get('method')).toBe('PDF text + on-device OCR')
  expect(String(extracted?.get('text'))).toContain('12345')
  expect(extracted?.get('pagesRead')).toBe('2')
  expect(extracted?.get('pageCount')).toBe('2')
  await page.getByRole('button', { name: 'View', exact: true }).click()
  await expect(page.locator('.viewer-controls')).toContainText('Page 1 / 2')
  await page.getByRole('button', { name: 'Next PDF page' }).click()
  await expect(page.locator('.viewer-controls')).toContainText('Page 2 / 2')
  await expect(page.locator('.pdf-stage canvas')).toBeVisible()
})

test('multiple uploads run with bounded concurrency and keep every completed result', async ({ page }) => {
  await mockWorkspace(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Preview travel-photo/ })).toBeVisible()
  let active = 0
  let peak = 0
  await page.route('**/api/files', async (route) => {
    const request = route.request()
    if (request.method() !== 'POST') return route.fallback()
    active++; peak = Math.max(active, peak)
    const form = await new Request(request.url(), { method: 'POST', headers: { 'content-type': request.headers()['content-type'] }, body: request.postDataBuffer()! }).formData()
    const file = form.get('file') as File
    await new Promise((resolve) => setTimeout(resolve, 400))
    active--
    return route.fulfill({ status: 201, json: { file: { ...files[1], id: form.get('uploadId'), name: file.name } } })
  })
  await page.locator('input[type=file]').setInputFiles(['one', 'two', 'three'].map((name) => ({ name: `${name}.txt`, mimeType: 'text/plain', buffer: Buffer.from('Invoice number 123 Bill to Acme Payment due') })))
  await expect(page.locator('.queue-panel')).toContainText('3 files sorted & ready to view')
  await expect(page.locator('.queue-item.is-done')).toHaveCount(3)
  expect(peak).toBe(2)
})

test('Jev review shows separate scores and supports confirming the fallback on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockWorkspace(page)
  const jev = { status: 'review', policyVersion: 'document-routing-v1', model: 'jev-1.13.0', suggestedCategory: 'Receipts', confidence: 0.58, probability: 0.6, evidenceProbability: 0.9, margin: 0.2, probabilities: { Receipts: 0.6, Invoices: 0.4 }, reason: 'The folder decision is uncertain.' }
  let confirmed = false
  await page.route('**/api/files/invoice-one**', (route) => {
    if (route.request().method() === 'PATCH') {
      expect(route.request().postDataJSON().category).toBe('Invoices')
      confirmed = true
    }
    return route.fulfill({ json: { file: { ...files[1], method: 'On-device OCR + Jev', ocrConfidence: 94, text: 'Invoice number 123', jev: { ...jev, status: confirmed ? 'corrected' : 'review', ...(confirmed ? { reviewedAt: Date.now() } : {}) } } } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: /Preview October-invoice/ }).click()
  await expect(page.getByText('Folder review recommended')).toBeVisible()
  await expect(page.getByText('Jev suggested: Receipts')).toBeVisible()
  await expect(page.getByText('Model confidence', { exact: true })).toBeVisible()
  await page.getByText('Category probabilities', { exact: true }).click()
  await expect(page.locator('.jev-alternatives')).toContainText('60%')
  await page.screenshot({ path: 'test-results/mobile-jev-review.png', fullPage: true })
  await page.getByRole('button', { name: 'Confirm current folder' }).click()
  await expect(page.getByText('Folder confirmed by you')).toBeVisible()
  await expect(page.getByText('Reviewed classification', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirm current folder' })).toHaveCount(0)
  for (const dark of [false, true]) {
    if (dark) await page.evaluate(() => document.documentElement.classList.add('dark'))
    const overflow = await page.locator('.file-dialog').evaluate((element) => element.scrollWidth > element.clientWidth + 1)
    expect(overflow).toBe(false)
  }
})
