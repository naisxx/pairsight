import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { failOnCspViolations } from './csp'

// The signed-out surface: landing, sign-in/up and the error page. None of it
// touches the database, so unlike the PairSight specs this runs in CI too.

failOnCspViolations()

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

// The hero's panel runs on the products demo's real recorded run
// (prisma/demo/sandbox-products-snapshot.json): 286 checked pairs, two vendors.
test('the landing’s demo results switch vendor', async ({ page }) => {
	await page.goto('/')
	const panel = page.getByRole('region', { name: 'Demo results' })
	const expectLegend = async (counts: [number, number, number, number]) => {
		const labels = ['both say same', 'only the vendor', 'only Jev', 'both say different']
		for (const [index, label] of labels.entries()) {
			// What's on screen: a phone's shorter label sits beside it, hidden.
			await expect(panel.getByRole('listitem').filter({ hasText: label })).toHaveText(
				`${counts[index]} ${label}`,
				{ useInnerText: true }
			)
		}
	}

	// Best overall score first: Atlas Resolve. The panel moves on to the next
	// vendor by itself until someone picks one, so pick it.
	const atlas = panel.getByRole('button', { name: 'Atlas Resolve' })
	await expect(atlas).toHaveAttribute('aria-pressed', 'true')
	await atlas.click()
	await expect(panel.locator('.landing-vendor-timer')).toHaveCount(0)
	await expect(
		panel.getByRole('img', { name: /^286 tiles, one per checked pair, for Atlas Resolve/ })
	).toBeVisible()
	await expectLegend([158, 44, 42, 42])
	await expect(panel).toContainText(
		'Atlas Resolve agrees with Jev on 200 of 286 pairs. Overall score 78.6%.'
	)

	await panel.getByRole('button', { name: 'Meridian Match' }).click()
	await expect(atlas).toHaveAttribute('aria-pressed', 'false')
	await expectLegend([118, 15, 82, 71])
	await expect(panel).toContainText(
		'Meridian Match agrees with Jev on 189 of 286 pairs. Overall score 70.9%.'
	)
})

test('the landing’s FAQ opens, and the section links scroll', async ({ page }) => {
	await page.goto('/')
	const answer = page.getByText('Jev is the AI that checks each pair.', { exact: false })
	await expect(answer).toBeHidden()
	await page.getByText('Who is Jev?').click()
	await expect(answer).toBeVisible()

	const sections = page.getByRole('navigation', { name: 'Sections' })
	await sections.getByRole('link', { name: 'Questions' }).click()
	await expect(page.getByRole('heading', { name: 'Asked and answered.' })).toBeInViewport()
	// The landing scrolls smoothly: let it come to rest before the next click.
	await expect(page.locator('html')).not.toHaveClass(/lenis-scrolling/)
	await sections.getByRole('link', { name: 'Inside' }).click()
	await expect(page.locator('#inside')).toBeInViewport()
})

test('the landing page starts dark, and a chosen theme survives a reload before paint', async ({
	page
}) => {
	const theme = () => page.evaluate(() => document.documentElement.dataset.theme)
	await page.emulateMedia({ colorScheme: 'light' })
	// Nothing chosen yet: the landing page is dark, the app follows the system.
	await page.goto('/')
	expect(await theme()).toBe('dark')
	await page.goto('/sign-in')
	expect(await theme()).toBe('light')

	await page.goto('/')
	await page.waitForLoadState('networkidle')
	const toggle = page.getByRole('button', { name: 'Dark theme' })
	await expect(toggle).toHaveAttribute('aria-pressed', 'true')
	await toggle.click()
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
	await expect(toggle).toHaveAttribute('aria-pressed', 'false')

	// The attribute is set by an inline script in <head>, so it's already
	// there when the document has only just been parsed: no flash first. The
	// choice now wins on the landing page too.
	await page.reload({ waitUntil: 'domcontentloaded' })
	expect(await theme()).toBe('light')
	await page.goto('/sign-in', { waitUntil: 'domcontentloaded' })
	expect(await theme()).toBe('light')
})

// src/proxy.ts: each page view gets its own nonce (a reused one could be
// copied into an injected script), and the pages still work under it: the
// theme switch needs both the page's scripts and next-themes' inline one.
test('pages run under a fresh script nonce', async ({ page }) => {
	const nonces: string[] = []
	for (const path of ['/', '/sign-in', '/']) {
		const response = await page.goto(path)
		const csp = (await response?.allHeaders())?.['content-security-policy'] ?? ''
		expect(csp).toContain("'strict-dynamic'")
		expect(csp).toContain("frame-ancestors 'none'")
		nonces.push(/'nonce-([^']+)'/.exec(csp)?.[1] ?? '')
	}
	expect(new Set(nonces).size).toBe(nonces.length)
	await page.waitForLoadState('networkidle')
	await page.getByRole('button', { name: 'Dark theme' }).click()
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('an unknown page answers 404 and says so', async ({ page }) => {
	const response = await page.goto('/no-such-page')
	expect(response?.status()).toBe(404)
	await expect(page.getByText('We can’t find that page')).toBeVisible()
})

test('the footer’s Privacy and Terms open their pages', async ({ page }) => {
	for (const name of ['Privacy', 'Terms']) {
		await page.goto('/')
		await page.getByRole('contentinfo').getByRole('link', { name, exact: true }).click()
		await expect(page).toHaveURL(new RegExp(`/${name.toLowerCase()}$`))
		await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
	}
})

// The files Records and Vendors offer to download (pnpm samples:build).
test('the sample files are served as CSV', async ({ request }) => {
	for (const name of ['records', 'vendor-pairs', 'vendor-groups']) {
		const response = await request.get(`/samples/pairsight-sample-${name}.csv`)
		expect(response.status()).toBe(200)
		expect((await response.text()).split('\n').length).toBeGreaterThan(2)
	}
})

for (const colorScheme of ['light', 'dark'] as const) {
	test.describe(`accessibility, ${colorScheme}`, () => {
		test.use({ colorScheme, contextOptions: { reducedMotion: 'reduce' } })

		for (const path of ['/', '/sign-in', '/sign-up', '/privacy', '/no-such-page']) {
			test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
				await page.goto(path)
				// A not-found page streams in as a bare shell first (Next sends the
				// 404 status before the layout); check the page a reader gets.
				await expect(page.locator('html')).toHaveAttribute('lang', /.+/)
				await expectNoAxeViolations(page)
			})
		}

		// The landing's phone layout (under 600px) is its own arrangement.
		test.describe('on a phone', () => {
			test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
			for (const path of ['/', '/sign-in']) {
				test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
					await page.goto(path)
					await expect(page.locator('html')).toHaveAttribute('lang', /.+/)
					await expectNoAxeViolations(page)
				})
			}
		})
	})
}
