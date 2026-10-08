import { execSync } from 'node:child_process'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { readPdfText } from './pdf'
import { exportFindings, readWorkbook } from './workbooks'

// The public sandbox (/sandbox): the whole app, read-only, on the prepared
// evaluation from `pnpm demo:seed`. Needs the local database, so it's opt-in
// like the PairSight slice (E2E_PAIRSIGHT=1).

const PASSWORD = 'e2e-password-123'
const SIGN_UP = /^Sign up to /
// WCAG 2.2 A and AA, the bar the design is held to (docs/PairSight-UX-Plan.md §12).
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

test.describe('Sandbox', () => {
	test.skip(process.env.E2E_PAIRSIGHT !== '1', 'Needs local Supabase: set E2E_PAIRSIGHT=1')
	test.describe.configure({ mode: 'serial' })

	// Seeding twice must leave the same sandbox: the seed is idempotent.
	test.beforeAll(() => {
		execSync('pnpm -s demo:seed', { stdio: 'ignore' })
		execSync('pnpm -s demo:seed', { stdio: 'ignore' })
	})

	// The three prepared evaluations (src/lib/pairsight/sandbox.ts).
	const SANDBOX = {
		person: '5a4db0c0-0000-4000-8000-000000000001',
		company: '5a4db0c0-0000-4000-9000-000000000001',
		product: '5a4db0c0-0000-4000-a000-000000000001'
	}
	const NAMES = [
		'Customer master — vendor check',
		'Supplier master — vendor check',
		'Product catalogue — vendor check'
	]
	const RESULTS = /\/sandbox\/[0-9a-f-]+\/runs\/[0-9a-f-]+\/results/
	const pipeline = (page: Page) => page.getByRole('list', { name: 'Steps' })
	const step = (page: Page, name: string) =>
		pipeline(page).getByRole('link', { name: new RegExp(`^${name},`) })

	test('signed out, every step opens read-only, from the landing page', async ({ page }) => {
		await page.goto('/')
		await page.getByRole('link', { name: 'Try the demo' }).first().click()
		await page.waitForURL((url) => url.pathname === '/sandbox')
		await expect(page.getByRole('note', { name: 'About the demo' })).toContainText(
			/sample data · look around, nothing can be changed\. Jev’s checks were recorded/
		)
		await expect(page.getByRole('link', { name: 'Sign up', exact: true })).toBeVisible()
		await page.getByRole('link', { name: NAMES[0], exact: true }).first().click()
		await page.waitForURL(RESULTS)

		// Records: the saved file, Replace is for accounts.
		await step(page, 'Records').click()
		await page.waitForURL(`**/sandbox/${SANDBOX.person}/records`)
		await expect(page.getByLabel('File details')).toContainText(/We matched \d+ fields? to your/)
		await expect(page.getByLabel('Sign up to upload your own records')).toBeVisible()

		// Vendors: both vendors, viewable; adding one needs an account.
		await step(page, 'Vendors').click()
		await page.waitForURL(`**/sandbox/${SANDBOX.person}/vendors`)
		const vendors = page.getByRole('navigation', { name: 'Vendors' })
		await expect(vendors).toContainText('List of pairs · ready')
		await expect(vendors).toContainText('List of groups · ready')
		await expect(page.getByLabel('Sign up to add or change vendors')).toBeVisible()
		await expect(page.getByLabel('What’s this vendor called?')).toBeDisabled()

		// What Jev checks: shown, not editable, and never saved.
		await step(page, 'What Jev checks').click()
		await page.waitForURL(`**/sandbox/${SANDBOX.person}/rules`)
		await expect(page.getByLabel('When are two records the same?', { exact: true })).toBeDisabled()
		await expect(
			page
				.getByRole('radiogroup', { name: 'How sure must Jev be?' })
				.getByRole('radio', { name: /^Balanced/ })
		).toBeDisabled()
		await expect(page.getByText('Demo · changes aren’t saved')).toBeVisible()

		// Plan: the ledger, but starting a run needs an account.
		await page.getByRole('link', { name: 'Check and start', exact: true }).click()
		await page.waitForURL(`**/sandbox/${SANDBOX.person}/plan`)
		await expect(page.getByRole('region', { name: 'From records to pairs' })).toBeVisible()
		await expect(page.getByLabel('Sign up to start a run')).toBeVisible()

		// Runs: the prepared run, complete, in the Runs centre; nothing to retry.
		await page.getByRole('button', { name: 'Runs', exact: true }).click()
		const runs = page.getByRole('dialog', { name: 'Runs' })
		await expect(runs.getByRole('radio', { name: /^Completed/ })).toBeChecked()
		const card = runs.getByRole('article', { name: /^Run 1 · Customer master/ })
		await expect(card).toContainText('Complete · Started')
		await expect(card).toContainText('265 pairs')
		await card.getByRole('link', { name: 'View results' }).click()
		await page.waitForURL(RESULTS)
	})

	test('people, organisations and products are three evaluations, side by side', async ({
		page
	}) => {
		await page.goto('/sandbox')
		await expect(page.getByLabel('Summary')).toContainText(/Evaluations\s*3/)
		for (const name of NAMES) {
			await expect(page.getByRole('link', { name, exact: true }).first()).toBeVisible()
		}
		// Each opens on its own: an organisation's definition, a product's fields.
		await page
			.getByRole('link', { name: 'Supplier master — vendor check', exact: true })
			.first()
			.click()
		await page.waitForURL(RESULTS)
		await expect(
			page
				.getByRole('region', { name: 'How do the vendors compare?' })
				.getByRole('link', { name: 'Meridian Match' })
		).toBeVisible()
		await step(page, 'What Jev checks').click()
		await page.waitForURL(`**/sandbox/${SANDBOX.company}/rules`)
		await expect(page.getByLabel('When are two records the same?', { exact: true })).toHaveValue(
			/same organisation/
		)
		await page.goto(`/sandbox/${SANDBOX.product}/records`)
		await expect(page.getByText('Barcode (GTIN)').first()).toBeVisible()
	})

	test('clicking the evaluation row opens it where it is up to: its results', async ({ page }) => {
		await page.goto('/sandbox')
		const row = page.locator('tbody tr', {
			has: page.getByRole('link', { name: 'Customer master — vendor check' })
		})
		// A cell, not the name link: the whole row opens it.
		await row.locator('td').nth(2).click()
		await page.waitForURL(RESULTS)
	})

	test('results and pairs: filters and the threshold preview work, nothing is saved', async ({
		page
	}) => {
		await page.goto(`/sandbox/${SANDBOX.person}/results`)
		await page.waitForURL(RESULTS)
		const tile = (name: string) =>
			page
				.getByRole('region', { name: 'Pairs by who says what', exact: true })
				.getByRole('link', { name: new RegExp(`^${name}: `) })
		for (const name of [
			'Both say same',
			'Only Jev says same',
			'Only vendor says same',
			'Both say different'
		]) {
			await expect(tile(name)).toBeVisible()
		}

		// Exporting needs no account here: the sandbox's data is fictional.
		const download = await exportFindings(page, 1, /^Excel/)
		const findings = await readWorkbook(await download.path())
		expect(findings.header).toContain('Northwind Match: group')
		expect(findings.header).toContain('Clearline Resolve: group')
		expect(findings.rows).toHaveLength(265)
		// So is the summary report: both vendors ranked, and the one-line head to head.
		const summary = await exportFindings(page, 1, /^Summary report/)
		const report = await readPdfText(await summary.path())
		expect(report).toContain('PairSight demo · sample data')
		expect(report).toMatch(/1 Clearline Resolve .* 2 Northwind Match/)
		expect(report).toContain('Jev sided with Northwind Match in 61 of 116')
		// The page names the same leader as the report, ranked the same way, and
		// both say a 1.2-point lead is too close to call a win.
		expect(report).toContain('but only just')
		const verdict = page.getByRole('heading', {
			name: /^Clearline Resolve and Northwind Match are close overall/
		})
		await expect(verdict).toContainText('81.2% vs 80.0%')
		await expect(page.getByText('Best overall', { exact: true })).toHaveCount(1)
		// The leader's card comes first, as the headline ranks them.
		await expect(page.getByRole('article').first()).toContainText('Clearline Resolve')

		// Another cut-off previews live on the cards; the run keeps its own, so
		// there's no Apply, and nothing's saved.
		await page.getByRole('button', { name: /^Match cut-off 0\.50/ }).click()
		const slider = page.getByRole('slider', { name: 'Match cut-off' })
		await slider.focus()
		for (let step = 0; step < 4; step++) await page.keyboard.press('PageUp')
		await expect(slider).toHaveAttribute('aria-valuetext', '0.90')
		await expect(page.getByText('Preview only · this run used 0.50')).toBeVisible()
		// The counts move; the lists they open stay at the run's cut-off, and say so.
		await expect(
			page.getByText('Preview counts. The pairs these open are at the run’s cut-off, 0.50.').first()
		).toBeVisible()
		await expect(page.getByRole('button', { name: 'Apply' })).toHaveCount(0)
		await page.reload()
		await expect(page.getByRole('button', { name: /^Match cut-off 0\.50/ })).toBeVisible()

		// Filters are just the URL, so they work; a pair opens, and J moves on.
		await tile('Only Jev says same').click()
		await page.waitForURL(/category=pairsight_only/)
		// The first pair shows beside the list; it opens on its own page too.
		const panel = page.getByRole('complementary', { name: 'The selected pair' })
		await expect(panel.getByRole('region', { name: 'Who says what' })).toContainText('JevSame')
		await panel.getByRole('link', { name: /^See all \d+ fields on its own page/ }).click()
		await page.waitForURL(/\/sandbox\/[0-9a-f-]+\/runs\/[0-9a-f-]+\/pairs\//)
		await expect(page.getByRole('region', { name: 'Who says what', exact: true })).toContainText(
			'JevSame'
		)
		const first = page.url()
		await page.keyboard.press('j')
		await expect(page).not.toHaveURL(first)
	})

	test('detailed analysis: filters show as chips, ? lists the shortcuts, the full comparison is a link away', async ({
		page
	}) => {
		await page.goto(`/sandbox/${SANDBOX.person}/results`)
		await page.waitForURL(RESULTS)
		await page.goto(`${page.url().split('?')[0]}?tab=detailed&status=evaluated`)

		// A filter in force is on screen, and its chip takes it off.
		const chip = page.getByRole('button', { name: 'Remove Checked?: Checked' })
		await expect(chip).toBeVisible()
		await expect(page.getByRole('button', { name: /^Filters/ })).toContainText('1')
		await chip.click()
		await expect(page).not.toHaveURL(/status=/)
		await expect(page.getByRole('button', { name: /^Remove / })).toHaveCount(0)

		// ? lists every shortcut, and so does the hint under the list.
		await page.keyboard.press('?')
		const shortcuts = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
		await expect(shortcuts).toContainText('Move between pairs')
		await page.keyboard.press('Escape')
		await expect(shortcuts).toHaveCount(0)
		await page.getByRole('button', { name: 'Press ? for keyboard shortcuts' }).click()
		await expect(shortcuts).toContainText('Open the selected pair on its own page')
		await page.keyboard.press('Escape')

		// Another cut-off is one link away: the Overview, with the drawer open.
		await expect(page.getByText('This list uses the run’s match cut-off, 0.50.')).toBeVisible()
		await page.getByRole('link', { name: 'Preview another on the Overview' }).click()
		await expect(page.getByRole('slider', { name: 'Match cut-off' })).toBeFocused()
		await expect(page).not.toHaveURL(/cutoff=/)
		await page.goBack()
		await expect(page).toHaveURL(/tab=detailed/)

		// The pair's full comparison, from the panel's header.
		await page
			.getByRole('complementary', { name: 'The selected pair' })
			.getByRole('link', { name: 'Full comparison' })
			.click()
		await page.waitForURL(/\/pairs\//)
		// Its own page answers to ? too, and Esc closes the list before leaving.
		await expect(page.getByRole('region', { name: 'Who says what', exact: true })).toBeVisible()
		await page.keyboard.press('?')
		await expect(shortcuts).toContainText('Back to the results')
		await page.keyboard.press('Escape')
		await expect(shortcuts).toHaveCount(0)
		await expect(page).toHaveURL(/\/pairs\//)
	})

	test('on a phone, a pair opens in a sheet over the list, and steps on from there', async ({
		browser
	}) => {
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
			hasTouch: true,
			isMobile: true,
			// Axe reads the page settled, not mid-animation (as the checks below do).
			reducedMotion: 'reduce'
		})
		const page = await context.newPage()
		await page.goto(`/sandbox/${SANDBOX.person}/results`)
		await page.waitForURL(RESULTS)
		await page.goto(`${page.url().split('?')[0]}?tab=detailed`)

		const selected = page.locator('[data-pairs-table] a[aria-current="true"]')
		await page.locator('[data-pairs-table] tbody a[href]').nth(1).tap()
		const sheet = page.getByRole('dialog', { name: 'The selected pair' })
		await expect(sheet.getByRole('complementary', { name: 'The selected pair' })).toBeVisible()
		const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
		expect(
			violations.map(({ id, nodes }) => `${id}: ${nodes.map((n) => n.target).join(' | ')}`)
		).toEqual([])
		const first = await selected.getAttribute('aria-label')
		await sheet.getByRole('button', { name: 'Next pair' }).tap()
		await expect(selected).not.toHaveAttribute('aria-label', first ?? '')
		await expect(page).toHaveURL(/sel=/)
		await sheet.getByRole('button', { name: 'Close the pair' }).tap()
		await expect(sheet).toHaveCount(0)
		await context.close()
	})

	test('the demo dashboard ranks vendors the way Results does, and an old demo link leads back', async ({
		page
	}) => {
		await page.goto('/sandbox')
		const latest = page.getByRole('region', { name: /vendor check$/ }).first()
		await expect(latest.getByRole('rowheader').first()).toHaveText('Atlas Resolve')
		await expect(latest).toContainText(/Atlas Resolve: \d+ disagreements to look at/)

		await page.goto('/sandbox/does-not-exist')
		await page.getByRole('link', { name: 'Back to the demo' }).click()
		await page.waitForURL((url) => url.pathname === '/sandbox')
	})

	test('signed in, the sandbox shows your account but none of your evaluations', async ({
		page
	}) => {
		await page.goto('/sign-up')
		await page.getByLabel('Email').fill(`e2e+${Date.now()}-sandbox@pairsight.test`)
		await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
		await page.getByRole('button', { name: 'Create account' }).click()
		await page.waitForURL('**/welcome**')
		await page.getByLabel('Full name').fill('Sandbox Visitor')
		await page.getByRole('button', { name: 'Continue' }).click()
		await page.waitForURL((url) => url.pathname === '/evaluations')
		await page.getByRole('link', { name: 'Try the demo' }).click()
		await page.waitForURL((url) => url.pathname === '/sandbox')

		await expect(page.getByRole('button', { name: 'Account: Sandbox Visitor' })).toBeVisible()
		await expect(page.getByRole('link', { name: 'Your evaluations' })).toBeVisible()
		// Only the prepared evaluations, and no way to rename or delete them.
		await expect(page.getByLabel('Summary')).toContainText(/Evaluations\s*3/)
		await page
			.getByRole('button', { name: /^Actions for / })
			.first()
			.click()
		await expect(page.getByRole('menuitem', { name: 'Open' })).toBeVisible()
		await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0)
		await expect(page.getByLabel(SIGN_UP)).toHaveCount(0)
	})

	// Every screen, read-only, in both themes: no WCAG A/AA violations.
	for (const colorScheme of ['light', 'dark'] as const) {
		test(`every screen passes an accessibility check, ${colorScheme}`, async ({ browser }) => {
			const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce' })
			const page = await context.newPage()
			const check = async (name: string) => {
				const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
				expect(
					violations.map(
						({ id, nodes }) => `${name} ${id}: ${nodes.map((n) => n.target).join(' | ')}`
					)
				).toEqual([])
			}
			await page.goto('/sandbox')
			await check('/sandbox')
			for (const path of ['/records', '/vendors', '/rules', '/plan', '/run']) {
				await page.goto(`/sandbox/${SANDBOX.person}${path}`)
				await check(path)
			}
			await page.goto(`/sandbox/${SANDBOX.person}/results`)
			await page.waitForURL(/\/results/)
			await check('results overview')
			await page.goto(`${page.url().split('?')[0]}?tab=detailed`)
			await check('results detailed')
			await page
				.getByRole('complementary', { name: 'The selected pair' })
				.getByRole('link', { name: /^See all \d+ fields on its own page/ })
				.click()
			await page.waitForURL(/\/pairs\//)
			await check('pair')
			await context.close()
		})
	}
})
