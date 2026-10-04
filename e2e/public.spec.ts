import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// The signed-out surface: landing, sign-in/up and the error page. None of it
// touches the database, so unlike the PairSight specs this runs in CI too.

// WCAG 2.2 A and AA, the bar the design is held to (docs/PairSight-UX-Plan.md §12).
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function expectNoAxeViolations(page: Page) {
	const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
	expect(
		violations.map(({ id, nodes }) => `${id}: ${nodes.map((n) => n.target).join(' | ')}`)
	).toEqual([])
}

test('the landing page is served unprefixed, and /en redirects to it', async ({ page }) => {
	const response = await page.goto('/')
	expect(new URL(response?.url() ?? '').pathname).toBe('/')
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

	await page.goto('/en')
	expect(new URL(page.url()).pathname).toBe('/')
})

test('a chosen theme survives a reload, applied before the page paints', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' })
	await page.goto('/')
	await page.getByRole('button', { name: 'Theme' }).click()
	await page.getByRole('menuitemradio', { name: 'Dark' }).click()
	await expect(page.locator('html')).toHaveClass(/\bdark\b/)

	// The class is set by an inline script in <head>, so it's already there
	// when the document has only just been parsed: no light flash first.
	await page.reload({ waitUntil: 'domcontentloaded' })
	expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true)

	// And back: the OS preference (light here) is followed again.
	await page.getByRole('button', { name: 'Theme' }).click()
	await page.getByRole('menuitemradio', { name: 'System' }).click()
	await page.reload({ waitUntil: 'domcontentloaded' })
	expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false)
})

test('an unknown page answers 404 and says so', async ({ page }) => {
	const response = await page.goto('/no-such-page')
	expect(response?.status()).toBe(404)
	await expect(page.getByText('We can’t find that page')).toBeVisible()
})

for (const colorScheme of ['light', 'dark'] as const) {
	test.describe(`accessibility, ${colorScheme}`, () => {
		test.use({ colorScheme, contextOptions: { reducedMotion: 'reduce' } })

		for (const path of ['/', '/sign-in', '/sign-up', '/no-such-page']) {
			test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
				await page.goto(path)
				await expectNoAxeViolations(page)
			})
		}
	})
}
