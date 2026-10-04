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
		await expect(page.getByRole('heading', { name: 'What each column holds' })).toBeVisible()
		await expect(page.getByLabel('Sign up to upload your own records')).toBeVisible()

		// Vendors: both vendors, viewable; adding one needs an account.
		await step(page, 'Vendors').click()
		await page.waitForURL(`**/sandbox/${SANDBOX.person}/vendors`)
		const vendors = page.getByRole('navigation', { name: 'Vendors' })
		await expect(vendors).toContainText('List of pairs · ready')
		await expect(vendors).toContainText('List of groups · ready')
		await expect(page.getByLabel('Sign up to add or change vendors')).toBeVisible()
		await expect(page.getByLabel('What’s this vendor called?')).toBeDisabled()

		// Rules: shown, not editable, and never saved.
		await step(page, 'Rules').click()
		await page.waitForURL(`**/sandbox/${SANDBOX.person}/rules`)
		await expect(page.getByRole('switch', { name: 'Same email rule' })).toBeDisabled()
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
		await expect(card).toContainText('8 pairs')
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
		// Each opens on its own: an organisation's rules, a product's fields.
		await page
			.getByRole('link', { name: 'Supplier master — vendor check', exact: true })
			.first()
			.click()
		await page.waitForURL(RESULTS)
		await expect(page.getByRole('radio', { name: 'Meridian Match' })).toBeVisible()
		await step(page, 'Rules').click()
		await page.waitForURL(`**/sandbox/${SANDBOX.company}/rules`)
		await expect(page.getByRole('switch', { name: 'Same website rule' })).toBeDisabled()
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
				.getByRole('region', { name: 'Pairs by who says what' })
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
		expect(findings.rows).toHaveLength(8)
		// So is the summary report: both vendors ranked, and the one-line head to head.
		const summary = await exportFindings(page, 1, /^Summary report/)
		const report = await readPdfText(await summary.path())
		expect(report).toContain('PairSight demo · sample data')
		expect(report).toMatch(/1 Clearline Resolve .* 2 Northwind Match/)
		expect(report).toContain('Jev sided with Clearline Resolve in 3 of 5')

		// The threshold previews live; a run keeps its own, so there's no Apply.
		await page.getByRole('button', { name: /^Match cut-off/ }).click()
		const value = page.getByLabel('Cut-off', { exact: true })
		await value.fill('0.90')
		await value.press('Enter')
		await expect(page.getByRole('dialog')).toContainText('becomes')
		await expect(page.getByRole('dialog').getByRole('button', { name: 'Apply' })).toHaveCount(0)
		await page.keyboard.press('Escape')
		await page.reload()
		await expect(page.getByRole('button', { name: /^Match cut-off 0\.50/ })).toBeVisible()

		// Filters are just the URL, so they work; a pair opens, and J moves on.
		await tile('Only Jev says same').click()
		await page.waitForURL(/category=pairsight_only/)
		await page.locator('[data-pairs-table] a[href*="/pairs/"]').first().click()
		await page.waitForURL(/\/sandbox\/[0-9a-f-]+\/runs\/[0-9a-f-]+\/pairs\//)
		await expect(page.getByRole('region', { name: 'Who says what', exact: true })).toContainText(
			'JevSame'
		)
		const first = page.url()
		await page.keyboard.press('j')
		await expect(page).not.toHaveURL(first)
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
			await page.locator('[data-pairs-table] a[href*="/pairs/"]').first().click()
			await page.waitForURL(/\/pairs\//)
			await check('pair')
			await context.close()
		})
	}
})
