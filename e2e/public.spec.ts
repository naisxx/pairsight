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

// The hero's panel runs on the demo's real recorded run
// (prisma/demo/sandbox-snapshot.json): 8 checked pairs, two vendors.
test('the landing’s demo results respond: vendor, match cut-off and a pair', async ({ page }) => {
	await page.goto('/')
	const panel = page.getByRole('region', { name: 'Demo results you can try' })
	const count = (category: string) => panel.getByTestId(`count-${category}`)
	const expectCounts = async (counts: [number, number, number, number]) => {
		const categories = ['both_matched', 'pairsight_only', 'vendor_only', 'neither_matched']
		for (const [index, category] of categories.entries()) {
			await expect(count(category)).toHaveText(String(counts[index]))
		}
	}

	// Northwind Match at 0.50: 2 merges Jev agrees with out of 4, 2 of 5 duplicates.
	await expectCounts([2, 3, 2, 1])
	await expect(panel.getByText('50.0%')).toBeVisible()
	await expect(panel.getByText('40.0%')).toBeVisible()

	// At the lowest cut-off Jev calls every pair the same.
	await panel.getByRole('slider', { name: 'Match cut-off' }).focus()
	await page.keyboard.press('Home')
	await expect(panel.locator('output')).toHaveText('0.01')
	await expectCounts([4, 4, 0, 0])

	await page.keyboard.press('End')
	await panel.getByRole('radio', { name: 'Clearline Resolve' }).click()
	await panel.getByRole('slider', { name: 'Match cut-off' }).focus()
	for (let step = 0; step < 49; step++) await page.keyboard.press('ArrowLeft')
	await expect(panel.locator('output')).toHaveText('0.50')
	await expectCounts([2, 3, 1, 2])

	// Opening a pair shows its two records and what the vendor said.
	await panel.getByRole('button', { name: /Tim Brennan/ }).click()
	const detail = panel.locator('#hero-pair')
	await expect(detail).toContainText('R05 · R04')
	await expect(detail).toContainText('Clearline Resolve kept these apart')
})

test('the landing’s FAQ opens, and the section links scroll', async ({ page }) => {
	await page.goto('/')
	const answer = page.getByText('Jev is TypeSafe’s AI.', { exact: false })
	await expect(answer).toBeHidden()
	await page.getByText('Who is Jev?').click()
	await expect(answer).toBeVisible()

	await page
		.getByRole('navigation', { name: 'Sections' })
		.getByRole('link', { name: 'FAQ' })
		.click()
	await expect(page.getByRole('heading', { name: 'Quick answers.' })).toBeInViewport()
	await page
		.getByRole('navigation', { name: 'Sections' })
		.getByRole('link', { name: 'A closer look' })
		.click()
	await expect(page.locator('#look')).toBeInViewport()
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

	// And back: the OS preference (light here) is followed again, once the
	// page is interactive (the menu is a client component).
	await page.waitForLoadState('networkidle')
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
