import { test, expect, type Page } from '@playwright/test'

const PASSPHRASE = 'e2e test passphrase'
const SESSION_COOKIE = 'clearfolio_session'

// These tests share one database *and one browser session* and run in
// declaration order: setup can only happen once per database, and the
// sign-out/sign-in flow depends on the cookie state left by earlier tests.
// The built-in `page`/`context` fixtures are function-scoped (a fresh,
// cookie-less context per test), so a single page is created in beforeAll
// and reused for the whole file instead.
test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
})

test.afterAll(async () => {
  await page.close()
})

test('first run walks through setup and reaches the dashboard', async () => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/setup/)

  await page.fill('input[name="householdName"]', 'E2E Household')
  await page.fill('input[name="displayName"]', 'Tester')
  await page.fill('input[name="passphrase"]', PASSPHRASE)
  await page.selectOption('select[name="preferredPeriodType"]', 'FY')
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByText('E2E Household')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

test('navigation and theme toggle render in the shell', async () => {
  await page.goto('/dashboard')

  await expect(page.getByRole('link', { name: 'Assets' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Projections' })).toBeVisible()

  const toggle = page.getByRole('button', { name: /^Theme:/ })
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/)
})

test('signing out ends the session and requires the passphrase again', async () => {
  await page.goto('/dashboard')

  // Capture the live session token before signing out, so we can prove the
  // server-side session row is actually destroyed below — not merely that
  // this browser's cookie jar got cleared (which alone wouldn't distinguish
  // a real logout from one that only forgets to call destroySession()).
  const context = page.context()
  const cookiesBefore = await context.cookies()
  const sessionCookie = cookiesBefore.find((c) => c.name === SESSION_COOKIE)
  expect(sessionCookie, 'a session cookie must exist while signed in').toBeTruthy()
  const liveToken = sessionCookie!.value

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login/)

  // The cookie itself must be gone from the browser.
  const cookiesAfter = await context.cookies()
  expect(cookiesAfter.some((c) => c.name === SESSION_COOKIE)).toBe(false)

  // The session is genuinely gone — the dashboard now redirects to login.
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)

  // Replay the old, pre-logout session token directly. If sign-out only
  // cleared the cookie on the client without destroying the server-side
  // session row, this would still authenticate and land on /dashboard.
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: liveToken,
      url: 'http://localhost:3100',
    },
  ])

  // Confirm the replay actually landed the cookie in the jar — otherwise
  // the redirect below would be caused by "no cookie" rather than "dead
  // session", and the assertion would prove nothing.
  const replayed = await context.cookies()
  const replayedSession = replayed.find((c) => c.name === SESSION_COOKIE)
  expect(replayedSession?.value, 'the old token must be present in the jar for this assertion to mean anything').toBe(liveToken)

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)

  // Clean up so the later sign-in tests start from a clean, cookie-free state.
  await context.clearCookies()
})

test('an incorrect passphrase is rejected', async () => {
  await page.goto('/login')
  await page.fill('input[name="passphrase"]', 'definitely wrong')
  await page.click('button[type="submit"]')

  // Next's route announcer also has role="alert" (empty, for SPA nav
  // a11y), so scope to the one carrying the error text.
  await expect(page.getByRole('alert').filter({ hasText: 'Incorrect passphrase' })).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test('the correct passphrase signs back in', async () => {
  await page.goto('/login')
  await page.fill('input[name="passphrase"]', PASSPHRASE)
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})
