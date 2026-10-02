import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// The PairSight vertical slice, end to end, against local Supabase and the Jev
// stub (scripts/jev-stub.mjs). Opt in with E2E_PAIRSIGHT=1 — CI's e2e job has
// no database or Supabase, so these are skipped there.

const FIXTURES = 'e2e/fixtures'
const PASSWORD = 'e2e-password-123'
const JEV_STUB = `http://127.0.0.1:${process.env.JEV_STUB_PORT ?? 4010}`

test.describe('PairSight vertical slice', () => {
	test.skip(
		process.env.E2E_PAIRSIGHT !== '1',
		'Needs local Supabase and the Jev stub: set E2E_PAIRSIGHT=1'
	)

	async function signUp(page: Page) {
		const email = `e2e+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@pairsight.test`
		await page.goto('/sign-up')
		await page.getByLabel('Email').fill(email)
		await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
		await page.getByRole('button', { name: 'Create account' }).click()
		// Onboarding asks for a full name before the app opens.
		await page.waitForURL('**/welcome**')
		await page.getByLabel('Full name').fill('Test Person')
		await page.getByRole('button', { name: 'Continue' }).click()
		await page.waitForURL('**/evaluations')
		return email
	}

	async function createEvaluation(page: Page, name: string) {
		// The first evaluation's button sits in the empty state; later ones in the header.
		await page.getByRole('button', { name: 'New evaluation' }).first().click()
		const dialog = page.getByRole('dialog', { name: 'New evaluation' })
		await dialog.getByLabel('Name').fill(name)
		await dialog.getByRole('button', { name: 'Create evaluation' }).click()
		await page.waitForURL('**/records')
	}

	// Each upload gets its own email domain, returned as a marker. The stub's
	// per-pair scripts (Flaky, Retrycase) then start fresh even on a stub that
	// outlived earlier runs, and its call counter sees this test's records only.
	async function uploadRecords(page: Page, file: string, { save = true } = {}) {
		const marker = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
		const csv = readFileSync(`${FIXTURES}/${file}`, 'utf8').replace(
			/@example\.com/gi,
			`@${marker}.example.com`
		)
		await page
			.locator('input[type=file]')
			.setInputFiles({ name: file, mimeType: 'text/csv', buffer: Buffer.from(csv) })
		await expect(page.getByText('Map your columns')).toBeVisible()
		if (save) {
			// Saving continues to Vendors.
			await page.getByRole('button', { name: 'Continue to vendors' }).click()
			await page.waitForURL('**/vendors')
		}
		return marker
	}

	// Jev calls the stub has received for one upload's records.
	async function jevCalls(page: Page, marker: string) {
		const response = await page.request.get(`${JEV_STUB}/calls?marker=${marker}`)
		const body: unknown = await response.json()
		if (typeof body !== 'object' || body == null || !('count' in body)) return Number.NaN
		return typeof body.count === 'number' ? body.count : Number.NaN
	}

	// Adds a vendor: a new draft, its file (format and columns worked out from
	// the records), then the completeness confirmation that makes it ready.
	async function addVendor(page: Page, file: string) {
		await page.getByRole('button', { name: 'Add vendor' }).click()
		await expect(page.getByText(/^Upload Vendor [A-C]’s export/)).toBeVisible()
		await page.locator('input[type=file]').setInputFiles(`${FIXTURES}/${file}`)
		const complete = page.getByRole('checkbox', { name: /^This export contains all of/ })
		await expect(complete).toBeEnabled()
		await complete.click()
		await expect(complete).toBeChecked()
		await expect(complete).toBeDisabled()
	}

	// The selected vendor's matched-pair count.
	async function expectVendorPairs(page: Page, count: number) {
		await expect(page.getByLabel('What the file contains')).toContainText(
			new RegExp(`Matched pairs\\s*${count}(?!\\d)`)
		)
	}

	// Rules save themselves; the plan opens once they have.
	async function reviewPlan(page: Page) {
		await expect(page.getByText('All changes saved')).toBeVisible()
		await page.getByRole('link', { name: 'Review comparison plan' }).click()
		await page.waitForURL('**/plan')
	}

	async function runEvaluation(page: Page) {
		await page.getByRole('link', { name: 'Continue to rules' }).click()
		await page.waitForURL('**/rules')
		await reviewPlan(page)
		await page.getByRole('button', { name: 'Start evaluation' }).click()
		await page.waitForURL(/\/runs\/[0-9a-f-]+$/)
		// Finished: complete, or with the pairs Jev couldn't judge called out.
		await expect(
			page.getByText(/^(Run complete|Finished with \d+ incomplete pairs?)$/)
		).toBeVisible({
			timeout: 45_000
		})
		await expect(page.getByText(/^Elapsed \d+:\d{2}$/)).toBeVisible()
		await page.getByRole('link', { name: 'View results' }).click()
		await page.waitForURL('**/results')
	}

	// The Overview's category tiles; each opens its pairs in the detailed view.
	function tile(page: Page, name: string) {
		return page
			.getByRole('region', { name: 'Pairs by category' })
			.getByRole('link', { name: new RegExp(`^${name}: `) })
	}

	// The detailed view's live count of matching pairs.
	function matching(page: Page) {
		return page.locator('p[aria-live]').filter({ hasText: /pairs?$/ })
	}

	test('the dashboard sums up evaluations, opens the latest results, and renames and deletes', async ({
		page
	}) => {
		await signUp(page)
		await expect(page.getByRole('heading', { name: 'Set up your first evaluation' })).toBeVisible()
		await createEvaluation(page, 'Dashboard check')
		await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await expectVendorPairs(page, 4)
		await page.getByRole('link', { name: 'Continue to rules' }).click()
		await reviewPlan(page)
		await page.getByRole('button', { name: 'Start evaluation' }).click()
		await expect(page.getByText(/Run complete/)).toBeVisible({ timeout: 45_000 })

		await page.goto('/evaluations')
		await createEvaluation(page, 'Still in setup')
		await page.goto('/evaluations')

		// Names are unique per account, whatever the casing.
		await page.getByRole('button', { name: 'New evaluation' }).first().click()
		const create = page.getByRole('dialog', { name: 'New evaluation' })
		await create.getByLabel('Name').fill('still IN setup')
		await create.getByRole('button', { name: 'Create evaluation' }).click()
		await expect(create.getByText('An evaluation with this name already exists')).toBeVisible()
		await create.getByRole('button', { name: 'Cancel' }).click()

		const summary = page.getByLabel('Summary')
		await expect(summary).toContainText(/Evaluations\s*2/)
		await expect(summary).toContainText(/With results\s*1/)
		await expect(summary).toContainText(/In setup\s*1/)
		await expect(summary).toContainText(/Pairs assessed\s*8/)

		// 2 both matched, 2 vendor only, 2 PairSight only: 50% precision and recall.
		const latest = page.getByRole('region', { name: 'Dashboard check' })
		await expect(latest.getByRole('row', { name: /Vendor A/ })).toContainText('50.0%')
		await latest.getByRole('link', { name: '4 disagreements for Vendor A' }).click()
		await page.waitForURL(/category=disagreements/)
		await expect(matching(page)).toHaveText('4 pairs')
		await page.goto('/evaluations')

		// Setup picks up where it stopped: records still to upload.
		const continueSetup = page.getByRole('region', { name: 'Continue setup' })
		await expect(continueSetup.getByRole('link', { name: /Still in setup/ })).toHaveAttribute(
			'href',
			/\/records$/
		)

		await page.getByRole('button', { name: 'Actions for Still in setup' }).click()
		await page.getByRole('menuitem', { name: 'Rename' }).click()
		const rename = page.getByRole('dialog', { name: 'Rename evaluation' })
		await rename.getByLabel('Name').fill('Renamed')
		await rename.getByRole('button', { name: 'Save name' }).click()
		await expect(page.getByRole('link', { name: 'Renamed', exact: true })).toBeVisible()

		await page.getByRole('button', { name: 'Actions for Renamed' }).click()
		await page.getByRole('menuitem', { name: 'Delete' }).click()
		await page
			.getByRole('dialog', { name: 'Delete this evaluation?' })
			.getByRole('button', { name: 'Delete evaluation' })
			.click()
		await expect(page.getByRole('link', { name: 'Renamed', exact: true })).toHaveCount(0)
		await expect(summary).toContainText(/Evaluations\s*1/)

		await page.getByRole('searchbox', { name: 'Search evaluations' }).fill('nothing like this')
		await expect(page.getByText('No evaluations match “nothing like this”')).toBeVisible()
	})

	test('upload to comparison: all four categories, vendor pairs outside blocking, inspection', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Demo scenario')
		await uploadRecords(page, 'demo-source.csv')
		await expect(
			page
				.getByRole('list', { name: 'Pipeline' })
				.getByRole('link', { name: /^Records, completed\. 24 records/ })
		).toBeVisible()
		await addVendor(page, 'demo-vendor-a.csv')
		await expectVendorPairs(page, 4)

		await page.getByRole('link', { name: 'Continue to rules' }).click()
		await reviewPlan(page)
		const plan = page.getByRole('region', { name: 'From records to pairs' })
		await expect(plan).toContainText(/Unique pairs to assess\s*8/)
		// All 4 vendor pairs are assessed; 2 of them the rules already found.
		await expect(plan).toContainText(/Pairs your vendors matched\s*\+4/)
		await expect(plan).toContainText('2 vendor pairs your rules already found')
		await page.getByRole('button', { name: 'Start evaluation' }).click()
		await expect(page.getByText(/Run complete/)).toBeVisible({ timeout: 45_000 })
		await page.getByRole('link', { name: 'View results' }).click()
		await page.waitForURL('**/results')

		for (const name of ['PairSight only', 'Vendor only', 'Both matched', 'Neither matched']) {
			await expect(tile(page, name)).toContainText('2')
		}
		await expect(tile(page, 'Incomplete')).toContainText('0')
		// Coverage: 6 pairs from the rules, 2 added only because the vendor matched them.
		const coverage = page.getByRole('region', { name: 'Assessment coverage' })
		await expect(coverage).toContainText(/From your rules\s*6/)
		await expect(coverage).toContainText(/Added because a vendor matched\s*2/)

		await tile(page, 'Vendor only').click()
		await page.waitForURL(/tab=detailed/)
		await expect(matching(page)).toHaveText('2 pairs')

		// From the keyboard: / jumps to search; ↓ then Enter opens the first pair.
		await page.keyboard.press('/')
		await expect(
			page.getByRole('searchbox', { name: 'Search by record reference or name' })
		).toBeFocused()
		await page.getByRole('heading', { level: 1 }).click()
		// A short window scrolled down, so coming back has a position to restore.
		await page.setViewportSize({ width: 1280, height: 480 })
		// The page scrolls inside the shell's <main>, not the window.
		await page.evaluate(() => {
			const main = document.getElementById('main')
			main?.scrollTo(0, main.scrollHeight)
		})
		await page.keyboard.press('ArrowDown')
		await expect(page.locator('tbody tr a').first()).toBeFocused()
		await page.keyboard.press('Enter')
		await page.waitForURL('**/pairs/**')
		// Vendor only: the vendor matched it, PairSight didn't.
		const decisions = page.getByRole('region', { name: 'Decisions' })
		await expect(decisions).toContainText(/Vendor A\s*Matched/)
		await expect(decisions).toContainText(/PairSight \(AI\)\s*No match/)
		await expect(page.getByText(/AI judgment — it may be wrong/)).toBeVisible()
		const firstPair = page.url()
		await page.keyboard.press('j')
		await expect(page).not.toHaveURL(firstPair)
		// The URL changes as the loading skeleton shows, and the pair can paint a
		// moment before its key handler attaches; press until it's listening.
		await expect(page.getByText('2 of 2')).toBeVisible()
		await expect(async () => {
			await page.keyboard.press('Escape')
			await expect(page).toHaveURL(/\/results\?/, { timeout: 1_000 })
		}).toPass({ timeout: 10_000 })
		await expect(page).toHaveURL(/category=vendor_only/)
		await expect
			.poll(() => page.evaluate(() => document.getElementById('main')?.scrollTop ?? 0))
			.toBeGreaterThan(0)
		await page.setViewportSize({ width: 1280, height: 720 })

		// The pair you came back from is highlighted.
		await expect(page).toHaveURL(/sel=/)

		// Filters that match nothing: the empty state says so and clears them.
		await page.goto(`${page.url()}&q=no-such-record`)
		await expect(page.getByRole('heading', { name: 'No pairs match these filters' })).toBeVisible()
		await page.getByRole('link', { name: 'Clear filters' }).click()
		// Clearing keeps the vendor and the detailed view, nothing else.
		await page.waitForURL(/\/results\?vendor=[^&]+&tab=detailed$/)
		await expect(matching(page)).toHaveText('8 pairs')
	})

	test('the threshold is set in Rules; a new run at it reuses every saved score', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Threshold and reuse')
		const marker = await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await runEvaluation(page)
		const callsBefore = await jevCalls(page, marker)
		expect(callsBefore).toBeGreaterThan(0)

		// Results preview another threshold, but a run keeps its own: no Apply.
		await page.getByRole('button', { name: /^Decision threshold 0\.50/ }).click()
		const thresholdValue = page.getByLabel('Threshold value')
		await thresholdValue.fill('0.40')
		await thresholdValue.press('Enter')
		const popover = page.getByRole('dialog')
		await expect(popover).toContainText(/PairSight only\s*2\s*becomes\s*3/)
		await expect(popover.getByRole('button', { name: 'Apply' })).toHaveCount(0)
		await popover.getByRole('button', { name: 'Reset to 0.50' }).click()
		await expect(thresholdValue).toHaveValue('0.50')
		await popover.getByRole('link', { name: 'Change in Rules' }).click()
		await page.waitForURL('**/rules')

		// Rules: a custom value, then a preset; either saves itself.
		const threshold = page.getByRole('radiogroup', { name: 'Match threshold' })
		await expect(threshold.getByRole('radio', { name: /^Balanced/ })).toBeChecked()
		await threshold.getByRole('radio', { name: 'Custom' }).click()
		const custom = page.getByLabel('Threshold', { exact: true })
		await custom.fill('0.62')
		await custom.press('Enter')
		await expect(
			page.getByText('Pairs Jev scores at or above 0.62 count as a match.')
		).toBeVisible()
		await threshold.getByRole('radio', { name: /^Lenient/ }).click()
		await expect(threshold.getByRole('radio', { name: /^Lenient/ })).toBeChecked()

		// The plan shows it, and nothing needs Jev again.
		await reviewPlan(page)
		const side = page.getByRole('region', { name: 'Match threshold' })
		await expect(side).toContainText(/0\.35\s*Lenient/)
		const plan = page.getByRole('region', { name: 'From records to pairs' })
		await expect(plan).toContainText(/Reused assessments\s*8/)
		await expect(plan).toContainText(/New Jev assessments\s*0\s*About \$0\.00 at a stand-in rate/)
		await page.getByRole('button', { name: 'Start evaluation' }).click()
		await page.waitForURL(/\/runs\/[0-9a-f-]+$/)
		await expect(page.getByRole('heading', { name: 'Run 2' })).toBeVisible()
		// Every score was reused, so it's complete from the start.
		await expect(page.getByText('Run complete', { exact: true })).toBeVisible()

		// The borderline Bob/Robert Chen pair (stub score 0.45) is a match at 0.35,
		// decided from the saved scores: Jev wasn't asked again.
		await page.getByRole('link', { name: 'View results' }).click()
		await page.waitForURL('**/results')
		await expect(page.getByRole('button', { name: /^Decision threshold 0\.35/ })).toBeVisible()
		await expect(tile(page, 'PairSight only')).toContainText('3')
		await expect(tile(page, 'Neither matched')).toContainText('1')
		expect(await jevCalls(page, marker)).toBe(callsBefore)

		// Results say which run they are; the first still decides at its own 0.50.
		const main = page.locator('#main')
		await expect(main.getByText('Run complete', { exact: true })).toBeVisible()
		await expect(main).toContainText('Run 2 ·')
		await page.getByRole('button', { name: 'Choose a run' }).click()
		await page.getByRole('menuitem', { name: /^Run 1 ·/ }).click()
		await expect(main).toContainText('Run 1 ·')
		await expect(page.getByRole('button', { name: /^Decision threshold 0\.50/ })).toBeVisible()
		await expect(tile(page, 'PairSight only')).toContainText('2')
	})

	test('a failed pair stays incomplete — never a nonmatch — and a retry can judge it', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Failures')
		const marker = await uploadRecords(page, 'failures-source.csv')
		await addVendor(page, 'failures-vendor.csv')
		await runEvaluation(page)

		// Failcase always fails and Retrycase fails its first call; Flaky's 529
		// is retried within the run and judged.
		await expect(tile(page, 'Incomplete')).toContainText('2')
		await expect(tile(page, 'Both matched')).toContainText('1')
		await expect(tile(page, 'Vendor only')).toContainText('0')
		await expect(page.locator('#main').getByText('2 incomplete', { exact: true })).toBeVisible()
		await expect(page.getByText('Provisional')).toBeVisible()

		// The status filter keeps judged pairs only, applied as it changes.
		await page.getByRole('link', { name: /^Detailed analysis/ }).click()
		await page.waitForURL(/tab=detailed/)
		await page.getByRole('combobox', { name: 'Assessment status' }).click()
		await page.getByRole('option', { name: 'Assessed' }).click()
		await expect(page).toHaveURL(/status=evaluated/)
		await expect(matching(page)).toHaveText('1 pair')
		await page.getByRole('button', { name: 'Clear filters' }).click()
		await expect(page).not.toHaveURL(/status=/)
		await page.getByRole('link', { name: /^Overview/ }).click()
		await page.waitForURL(/\/results\?vendor=[^&]+$/)

		// Retrying one pair from its page: Jev judges it this time.
		await tile(page, 'Incomplete').click()
		await page.waitForURL(/category=incomplete/)
		await expect(page.getByText('Failed · Request rejected').first()).toBeVisible()
		await page.locator('tbody tr').filter({ hasText: 'Retrycase' }).locator('a').click()
		await page.waitForURL('**/pairs/**')
		await page.getByRole('button', { name: 'Retry this pair' }).click()
		await expect(page.getByRole('region', { name: 'Decisions' })).toContainText(
			/PairSight \(AI\)\s*Match/,
			{ timeout: 30_000 }
		)
		await page.getByRole('link', { name: 'Back to results' }).click()
		await page.waitForURL(/\/results\?/)

		// A failed row can be retried from the table too; Failcase fails again.
		const rowCalls = await jevCalls(page, marker)
		await page.getByRole('button', { name: /^Retry pair F\d and F\d$/ }).click()
		await expect(
			page.getByText('Jev couldn’t judge it this time either.', { exact: false })
		).toBeVisible({
			timeout: 30_000
		})
		expect(await jevCalls(page, marker)).toBe(rowCalls + 1)
		await page.getByRole('link', { name: /^Overview/ }).click()
		await expect(tile(page, 'Incomplete')).toContainText('1')
		await expect(tile(page, 'Both matched')).toContainText('2')

		// Retry failed on the Run page asks Jev again about the pair that's
		// still failed; Failcase fails again and stays incomplete.
		await page.getByRole('list', { name: 'Pipeline' }).getByRole('link', { name: /^Run,/ }).click()
		const failures = page.getByRole('heading', { name: 'Why pairs failed' }).locator('..')
		await expect(failures).toContainText('Request rejected· 1 pair')
		const callsBefore = await jevCalls(page, marker)
		await page.getByRole('button', { name: 'Retry 1 failed' }).click()
		await expect.poll(() => jevCalls(page, marker), { timeout: 30_000 }).toBe(callsBefore + 1)
		await expect(page.getByText('1 assessment is incomplete.')).toBeVisible({ timeout: 30_000 })
		await expect(failures).toContainText('Request rejected· 1 pair')
	})

	test('a rejected API key stops the run with the fix, and it resumes once the key works', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Key problem')
		const marker = await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await expectVendorPairs(page, 4)
		await page.request.post(`${JEV_STUB}/reject?marker=${marker}`)

		await page.getByRole('link', { name: 'Continue to rules' }).click()
		await page.waitForURL('**/rules')
		await reviewPlan(page)
		await page.getByRole('button', { name: 'Start evaluation' }).click()
		await page.waitForURL(/\/runs\/[0-9a-f-]+$/)
		const stopped = page.getByRole('alert').filter({ hasText: 'The run stopped' })
		await expect(stopped).toContainText('TypeSafe rejected the API key', { timeout: 30_000 })
		// Stopped, the one way forward is Resume; results wait for a finished run.
		await expect(page.getByRole('link', { name: 'View results' })).toHaveCount(0)

		// The key is fixed; resuming judges every pair.
		await page.request.post(`${JEV_STUB}/accept?marker=${marker}`)
		await page.getByRole('button', { name: 'Resume' }).click()
		await expect(page.getByText(/Run complete/)).toBeVisible({ timeout: 45_000 })
		await expect(stopped).toHaveCount(0)
		await expect(page.getByText('8 / 8', { exact: true })).toBeVisible()
	})

	test('invalid references are blocked with row numbers', async ({ page }) => {
		await signUp(page)
		await createEvaluation(page, 'Validation')
		await uploadRecords(page, 'invalid-source.csv', { save: false })
		// Checked as soon as the reference column is chosen: one missing, one repeated.
		const validation = page.getByRole('region', { name: 'Validation' })
		await expect(validation).toContainText('2 reference problems')
		await expect(validation).toContainText(/Row 4\s*·\s*Missing reference/)
		await expect(validation).toContainText(/Rows 2, 3\s*·\s*Duplicate reference\s*R1/)
		await expect(page.getByRole('button', { name: 'Continue to vendors' })).toBeDisabled()
		await expect(page.getByText('Resolve 2 reference problems')).toBeVisible()

		await page.getByRole('button', { name: 'Replace file' }).click()
		await uploadRecords(page, 'demo-source.csv')

		// Saved, the file reads back with its mapping; replacing it asks first.
		await page.goto(page.url().replace(/\/vendors$/, '/records'))
		await expect(page.getByRole('heading', { name: 'Column mapping' })).toBeVisible()
		await expect(page.getByLabel('File details')).toContainText('demo-source.csv')
		await page.getByRole('button', { name: 'Replace file' }).click()
		const replace = page.getByRole('dialog', { name: 'Replace records file?' })
		await replace.getByRole('button', { name: 'Keep current file' }).click()
		await expect(page.getByRole('heading', { name: 'Column mapping' })).toBeVisible()
		await page.getByRole('link', { name: 'Continue to vendors' }).click()
		await page.waitForURL('**/vendors')

		await page.getByRole('button', { name: 'Add vendor' }).click()
		await page.locator('input[type=file]').setInputFiles(`${FIXTURES}/unknown-vendor.csv`)
		await expect(
			page.getByText(/1 reference isn’t in the source records: Row 2: “R99”/)
		).toBeVisible()
		await expect(
			page.getByRole('checkbox', { name: /^This export contains all of/ })
		).toBeDisabled()
		await expect(page.getByRole('link', { name: 'Continue to rules' })).toHaveCount(0)

		// A vendor can be renamed at any point.
		const name = page.getByLabel('Vendor name')
		await name.fill('Acme Match')
		await name.press('Enter')
		await expect(page.getByRole('navigation', { name: 'Vendors' })).toContainText('Acme Match')
	})

	test('an over-cap plan is blocked with its cause, and a custom rule brings it under', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Over the cap')
		await uploadRecords(page, 'over-cap-source.csv')
		await expect(
			page
				.getByRole('list', { name: 'Pipeline' })
				.getByRole('link', { name: /^Records, completed\. 105 records/ })
		).toBeVisible()
		await addVendor(page, 'over-cap-vendor.csv')
		await expectVendorPairs(page, 1)

		await page.getByRole('link', { name: 'Continue to rules' }).click()
		await page.waitForURL('**/rules')
		await expect(page.getByText('This rule alone creates 5,460 pairs').first()).toBeVisible()
		// The live summary and the action bar say it before the plan does.
		await expect(
			page.getByText('460 pairs over the limit. Turn off or tighten a rule.')
		).toBeVisible()
		await expect(page.getByText('Reduce pairs to 5,000 or fewer (now 5,460)')).toBeVisible()
		await expect(page.getByRole('link', { name: 'Review comparison plan' })).toHaveCount(0)
		await page.goto(page.url().replace(/\/rules$/, '/plan'))
		const overLimit = page.getByRole('heading', {
			name: '5,460 pairs is over the 5,000-pair limit'
		})
		await expect(overLimit).toBeVisible()
		await expect(
			page.getByRole('listitem').filter({ hasText: 'Same name and postcode' })
		).toContainText('5,460 pairs · largest bucket 105')
		await expect(page.getByRole('button', { name: 'Start evaluation' })).toBeDisabled()

		// Turning the rule off from the plan brings it under the limit.
		await page.getByRole('button', { name: 'Turn off Same name and postcode' }).click()
		await expect(overLimit).toHaveCount(0)
		await page.getByRole('link', { name: 'Rules', exact: true }).click()
		await page.waitForURL('**/rules')
		await expect(
			page.getByRole('switch', { name: 'Same name and postcode rule' })
		).not.toBeChecked()
		await page.getByRole('button', { name: 'Add composite rule' }).click()
		const fields = page.getByRole('group', { name: 'Fields in this rule' })
		await fields.getByRole('button', { name: 'Email' }).click()
		await expect(page.getByText('A rule with these fields already exists.')).toBeVisible()
		await fields.getByRole('button', { name: 'Postcode' }).click()
		await expect(page.getByRole('button', { name: 'Save rule' })).toBeEnabled()
		await page.getByRole('button', { name: 'Save rule' }).click()
		await expect(page.getByRole('button', { name: 'Edit Email + Postcode' })).toBeVisible()

		await reviewPlan(page)
		await expect(page.getByRole('region', { name: 'From records to pairs' })).toContainText(
			/Unique pairs to assess\s*1/
		)
		await expect(page.getByRole('button', { name: 'Start evaluation' })).toBeEnabled()

		// The composite rule was saved with the rest of the configuration.
		await page.goto(page.url().replace(/\/plan$/, '/rules'))
		await expect(page.getByRole('button', { name: 'Edit Email + Postcode' })).toBeVisible()
	})

	test('changing the country saves itself and recounts the phone rule', async ({ page }) => {
		await signUp(page)
		await createEvaluation(page, 'Country change')
		await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await page.getByRole('link', { name: 'Continue to rules' }).click()
		await page.waitForURL('**/rules')
		const phoneRule = page.locator('li').filter({ hasText: 'Same phone' })
		const before = await phoneRule.innerText()

		await page.getByRole('combobox', { name: 'Country context' }).click()
		await page.getByRole('option', { name: 'United Kingdom' }).click()
		await expect(page.getByText('All changes saved')).toBeVisible()
		// US numbers don't parse as British ones, so the phone rule's counts change.
		await expect(phoneRule).not.toHaveText(before)
		await page.reload()
		await expect(page.getByRole('combobox', { name: 'Country context' })).toHaveText(
			'United Kingdom'
		)
	})

	test('rule changes save themselves; invalid ones are held back and say why', async ({ page }) => {
		await signUp(page)
		await createEvaluation(page, 'Autosave')
		await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await page.getByRole('link', { name: 'Continue to rules' }).click()
		await page.waitForURL('**/rules')
		const stepLink = (name: string) =>
			page
				.getByRole('list', { name: 'Pipeline' })
				.getByRole('link', { name: new RegExp(`^${name},`) })

		// A switch saves itself and is still on after leaving and coming back.
		const nameRule = page.getByRole('switch', { name: 'Same name rule' })
		await nameRule.click()
		await expect(page.getByText('All changes saved')).toBeVisible()
		await stepLink('Vendors').click()
		await page.waitForURL('**/vendors')
		await stepLink('Rules').click()
		await page.waitForURL('**/rules')
		await expect(nameRule).toBeChecked()

		// An empty definition is never saved: the reason shows, the plan waits.
		const same = page.getByLabel('Counts as the same individual')
		const definition = await same.inputValue()
		await same.fill('')
		await expect(
			page.getByText('Describe what counts as the same individual').first()
		).toBeVisible()
		await expect(page.getByRole('link', { name: 'Review comparison plan' })).toHaveCount(0)
		await page.reload()
		await expect(same).toHaveValue(definition)

		// One field isn't enough for Jev to tell people apart.
		const jevFields = page.getByRole('group', { name: 'Fields used for assessment' })
		for (const field of [
			'Last name',
			'Email',
			'Phone',
			'Date of birth',
			'Address',
			'City',
			'Postcode'
		]) {
			await jevFields.getByLabel(field).uncheck()
		}
		await expect(page.getByText('Select at least two fields.')).toBeVisible()
		await jevFields.getByLabel('Email').check()
		await reviewPlan(page)
	})

	test('two vendors are compared side by side', async ({ page }) => {
		await signUp(page)
		await createEvaluation(page, 'Two vendors')
		await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await expectVendorPairs(page, 4)

		// Vendor B starts as a draft that survives a reload until it's finished.
		await page.getByRole('button', { name: 'Add vendor' }).click()
		const vendorList = page.getByRole('navigation', { name: 'Vendors' })
		await expect(vendorList).toContainText('Needs: upload a valid export')
		await page.reload()
		await expect(vendorList).toContainText('Needs: upload a valid export')
		await expect(page.getByText('Finish Vendor B: upload a valid export')).toBeVisible()

		// A group export: one record per row, read without choosing any columns.
		await page.locator('input[type=file]').setInputFiles(`${FIXTURES}/demo-vendor-b-groups.csv`)
		await expect(
			page.getByText('Read as one record per row, grouped by match_id · references in record')
		).toBeVisible()
		await expectVendorPairs(page, 3)
		await page.getByRole('checkbox', { name: /^This export contains all of/ }).click()
		await expect(vendorList).toContainText('Group format · ready')
		await runEvaluation(page)

		// One vendor at a time, switchable; and both side by side.
		await expect(page.getByRole('radio', { name: 'Vendor B' })).toBeVisible()
		const comparison = page.getByRole('region', { name: 'Vendor comparison' })
		await expect(comparison).toBeVisible()
		await comparison.getByRole('button', { name: 'Show as table' }).click()
		await expect(comparison.getByRole('rowheader')).toHaveText(['Vendor A', 'Vendor B'])
		await expect(page.getByRole('region', { name: 'Where vendors agree' })).toBeVisible()
	})

	test('three vendors are compared side by side, and that’s the limit', async ({ page }) => {
		await signUp(page)
		await createEvaluation(page, 'Three vendors')
		await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await addVendor(page, 'demo-vendor-b.csv')
		await addVendor(page, 'demo-vendor-c.csv')
		await expect(page.getByRole('navigation', { name: 'Vendors' })).toContainText(
			/Vendor C\s*Pair format · ready/
		)
		// A fourth can't be added: the button gives way to the limit.
		await expect(page.getByRole('button', { name: 'Add vendor' })).toHaveCount(0)
		await expect(page.getByText('You can compare up to 3 vendors.')).toBeVisible()
		await runEvaluation(page)

		await expect(page.getByRole('radio', { name: 'Vendor C' })).toBeVisible()
		const comparison = page.getByRole('region', { name: 'Vendor comparison' })
		await comparison.getByRole('button', { name: 'Show as table' }).click()
		await expect(comparison.getByRole('rowheader')).toHaveText(['Vendor A', 'Vendor B', 'Vendor C'])
		await expect(page.getByRole('region', { name: 'Where vendors agree' })).toBeVisible()

		// Each vendor's own results: Vendor C's matches, judged against Jev.
		await page.getByRole('radio', { name: 'Vendor C' }).click()
		await expect(page).toHaveURL(/vendor=/)
		await expect(tile(page, 'Both matched')).toBeVisible()
	})

	test('locked steps can’t be opened by URL: they land where the evaluation is up to', async ({
		page
	}) => {
		await signUp(page)
		await expect(page.getByRole('heading', { name: 'Set up your first evaluation' })).toBeVisible()

		await createEvaluation(page, 'Locked steps')
		const records = page.url()
		for (const step of ['vendors', 'rules', 'plan', 'run', 'results']) {
			await page.goto(records.replace(/\/records$/, `/${step}`))
			await page.waitForURL(records)
			await expect(page.getByText('Drop your customer CSV here')).toBeVisible()
		}

		// With records but no vendor, the plan still waits for one.
		await uploadRecords(page, 'demo-source.csv')
		await page.goto(records.replace(/\/records$/, '/plan'))
		await page.waitForURL('**/vendors')
	})

	test('signed in, “home” is your evaluations, never the landing page', async ({ page }) => {
		await signUp(page)
		for (const path of ['/', '/sign-in', '/sign-up']) {
			await page.goto(path)
			await page.waitForURL((url) => url.pathname === '/evaluations')
		}
		await page.goto('/no-such-page')
		await expect(page.getByText('Page not found')).toBeVisible()
		await page.getByRole('link', { name: 'Evaluations', exact: true }).click()
		await page.waitForURL((url) => url.pathname === '/evaluations')
	})

	test('signing out ends the session: the app asks you to sign in again', async ({ page }) => {
		await signUp(page)
		await page.getByRole('button', { name: 'Account: Test Person' }).click()
		await page.getByRole('menuitem', { name: 'Sign out' }).click()
		await page.waitForURL((url) => !url.pathname.startsWith('/evaluations'))
		await page.goto('/evaluations')
		await page.waitForURL('**/sign-in**')
		await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
	})

	test('an evaluation that doesn’t exist, or isn’t a valid id, is a 404', async ({ page }) => {
		await signUp(page)
		for (const id of ['00000000-0000-4000-8000-000000000000', 'not-an-id']) {
			const response = await page.goto(`/evaluations/${id}/records`)
			expect(response?.status()).toBe(404)
			await expect(page.getByText('Page not found')).toBeVisible()
		}
	})

	test('the sidebar shows the pipeline, collapses, and remembers its width', async ({ page }) => {
		await signUp(page)
		await createEvaluation(page, 'Shell')
		const pipeline = page.getByRole('list', { name: 'Pipeline' })
		await expect(
			pipeline.getByRole('link', { name: /^Records, next step\. No file yet/ })
		).toBeVisible()
		await expect(page.getByRole('banner').getByText('Draft', { exact: true })).toBeVisible()

		await uploadRecords(page, 'demo-source.csv')
		await expect(
			pipeline.getByRole('link', { name: /^Records, completed\. 24 records/ })
		).toBeVisible()
		await expect(
			pipeline.getByRole('link', { name: /^Vendors, next step\. None added/ })
		).toBeVisible()
		// Locked stages say what they're waiting for.
		await expect(
			pipeline.getByRole('link', { name: /^Run, locked\. Start a run from the plan first/ })
		).toBeVisible()

		const shell = page.locator('.app-shell')
		await expect(shell).toHaveAttribute('data-collapsed', 'false')
		await page.getByRole('button', { name: 'Collapse sidebar' }).click()
		await expect(shell).toHaveAttribute('data-collapsed', 'true')
		await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
		// The width is remembered, and the server renders it on the first paint.
		await page.reload()
		await expect(shell).toHaveAttribute('data-collapsed', 'true')
		await page.keyboard.press('[')
		await expect(shell).toHaveAttribute('data-collapsed', 'false')
		await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()

		// On phones the sidebar is a drawer, opened from the top bar.
		await page.setViewportSize({ width: 390, height: 844 })
		await page.getByRole('button', { name: 'Open navigation' }).click()
		const drawer = page.getByRole('dialog', { name: 'Navigation' })
		await expect(drawer).toBeVisible()
		await expect(shell).toHaveAttribute('data-mobile-open', 'true')
		await drawer.getByRole('button', { name: 'Close navigation' }).click()
		await expect(drawer).toHaveCount(0)
		await page.getByRole('button', { name: 'Open navigation' }).click()
		await expect(drawer).toBeVisible()
		await page.keyboard.press('Escape')
		await expect(shell).toHaveAttribute('data-mobile-open', 'false')
	})

	test('sign-in checks each field once submitted, and can show the password', async ({ page }) => {
		await page.goto('/sign-in')
		const email = page.getByLabel('Email')
		const password = page.getByLabel('Password', { exact: true })
		// Leaving a field empty isn't an error until the form is submitted.
		await email.focus()
		await password.focus()
		await expect(page.getByText('Enter your email address')).toHaveCount(0)

		await page.getByRole('button', { name: 'Sign in', exact: true }).click()
		await expect(page.getByText('Enter your email address')).toBeVisible()
		await expect(page.getByText('Enter a password')).toBeVisible()
		await email.fill('not-an-email')
		await expect(page.getByText('Enter a valid email, like name@company.com')).toBeVisible()

		await password.fill('secret-words')
		await expect(password).toHaveAttribute('type', 'password')
		await page.getByRole('button', { name: 'Show password' }).click()
		await expect(password).toHaveAttribute('type', 'text')
		await page.getByRole('button', { name: 'Hide password' }).click()
		await expect(password).toHaveAttribute('type', 'password')
	})

	test('onboarding asks for a full name first, then the account shows it', async ({ page }) => {
		await page.goto('/sign-up')
		await page.getByLabel('Email').fill(`e2e+${Date.now()}-name@pairsight.test`)
		await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
		await page.getByRole('button', { name: 'Create account' }).click()
		await page.waitForURL('**/welcome**')

		// The app stays closed until a name is saved.
		await page.goto('/evaluations')
		await page.waitForURL('**/welcome**')
		await page.getByRole('button', { name: 'Continue' }).click()
		await expect(page.getByText('Enter your name')).toBeVisible()

		await page.getByLabel('Full name').fill('  Ana María López  ')
		await page.getByRole('button', { name: 'Continue' }).click()
		await page.waitForURL('**/evaluations')
		const account = page.getByRole('button', { name: 'Account: Ana María López' })
		await expect(account).toBeVisible()
		await expect(account).toContainText('AM')
	})

	test('an evaluation is invisible to another user', async ({ browser }) => {
		const owner = await browser.newPage()
		await signUp(owner)
		await createEvaluation(owner, 'Private')
		const privateUrl = owner.url()

		const other = await (await browser.newContext()).newPage()
		await signUp(other)
		await other.goto(privateUrl)
		await expect(other.getByText('Page not found')).toBeVisible()
	})
})
