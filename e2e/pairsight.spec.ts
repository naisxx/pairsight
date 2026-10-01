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
		await page.getByLabel('Password').fill(PASSWORD)
		await page.getByRole('button', { name: 'Create account' }).click()
		// Onboarding asks for a full name before the app opens.
		await page.waitForURL('**/welcome**')
		await page.getByLabel('Full name').fill('Test Person')
		await page.getByRole('button', { name: 'Continue' }).click()
		await page.waitForURL('**/evaluations')
		return email
	}

	async function createEvaluation(page: Page, name: string) {
		await page.getByLabel('Name').fill(name)
		await page.getByRole('button', { name: 'Create evaluation' }).click()
		await page.waitForURL('**/records')
	}

	// Each upload gets its own email domain, returned as a marker. The stub's
	// per-pair scripts (Flaky, Retrycase) then start fresh even on a stub that
	// outlived earlier runs, and its call counter sees this test's records only.
	async function uploadRecords(page: Page, file: string) {
		const marker = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
		const csv = readFileSync(`${FIXTURES}/${file}`, 'utf8').replace(
			/@example\.com/gi,
			`@${marker}.example.com`
		)
		await page
			.locator('input[type=file]')
			.setInputFiles({ name: file, mimeType: 'text/csv', buffer: Buffer.from(csv) })
		await expect(page.getByText('Map your columns')).toBeVisible()
		await page.getByRole('button', { name: 'Save records' }).click()
		return marker
	}

	// Jev calls the stub has received for one upload's records.
	async function jevCalls(page: Page, marker: string) {
		const response = await page.request.get(`${JEV_STUB}/calls?marker=${marker}`)
		const body: unknown = await response.json()
		if (typeof body !== 'object' || body == null || !('count' in body)) return Number.NaN
		return typeof body.count === 'number' ? body.count : Number.NaN
	}

	async function addVendor(page: Page, file: string) {
		await page.getByRole('link', { name: 'Continue to vendors' }).click()
		await page.waitForURL('**/vendors')
		await page.locator('input[type=file]').setInputFiles(`${FIXTURES}/${file}`)
		await page.getByRole('checkbox').click()
		await page.getByRole('button', { name: 'Add vendor' }).click()
	}

	async function runEvaluation(page: Page) {
		await page.getByRole('link', { name: 'Continue to rules' }).click()
		await page.waitForURL('**/rules')
		await page.getByRole('button', { name: 'Review plan' }).click()
		await page.waitForURL('**/plan')
		await page.getByRole('button', { name: 'Start evaluation' }).click()
		await page.waitForURL(/\/runs\/[0-9a-f-]+$/)
		await expect(page.getByText(/Run complete/)).toBeVisible({ timeout: 45_000 })
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

	test('upload to comparison: all four categories, vendor pairs outside blocking, inspection', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Demo scenario')
		await uploadRecords(page, 'demo-source.csv')
		await expect(page.getByText('demo-source.csv · 24 records')).toBeVisible()
		await addVendor(page, 'demo-vendor-a.csv')
		await expect(page.getByText(/Added 4 pairs/)).toBeVisible()

		await page.getByRole('link', { name: 'Continue to rules' }).click()
		await page.getByRole('button', { name: 'Review plan' }).click()
		await page.waitForURL('**/plan')
		const plan = page.locator('dl')
		await expect(plan).toContainText('Unique pairs to compare8')
		await expect(plan).toContainText('Added only because a vendor matched them2')
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

	test('changing the threshold re-decides from saved scores; a new run reuses every assessment', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Threshold and reuse')
		const marker = await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await runEvaluation(page)
		const callsBefore = await jevCalls(page, marker)
		expect(callsBefore).toBeGreaterThan(0)

		// The popover previews the change before anything is saved.
		await page.getByRole('button', { name: /^Decision threshold/ }).click()
		const thresholdValue = page.getByLabel('Threshold value')
		await thresholdValue.fill('0.40')
		await thresholdValue.press('Enter')
		await expect(page.getByRole('dialog')).toContainText(/PairSight only\s*2\s*becomes\s*3/)
		await page.getByRole('button', { name: 'Apply' }).click()
		// The borderline Bob/Robert Chen pair (stub score 0.45) crosses the new threshold.
		await expect(tile(page, 'PairSight only')).toContainText('3')
		await expect(tile(page, 'Neither matched')).toContainText('1')
		// Re-decided from the saved scores: Jev wasn't asked again.
		expect(await jevCalls(page, marker)).toBe(callsBefore)
		// The run remembers what it started with, and can preview going back.
		await expect(page.locator('#main')).toContainText('Run started at 0.50')
		await page.getByRole('button', { name: /^Decision threshold/ }).click()
		await page.getByRole('button', { name: 'Reset to 0.50' }).click()
		await expect(page.getByLabel('Threshold value')).toHaveValue('0.50')
		await expect(page.getByRole('dialog')).toContainText(/PairSight only\s*3\s*becomes\s*2/)
		await page.keyboard.press('Escape')

		const evaluationPath = new URL(page.url()).pathname.split('/runs/')[0]
		await page.goto(`${evaluationPath}/plan`)
		const plan = page.locator('dl')
		await expect(plan).toContainText('Already judged in an earlier run (reused)8')
		await expect(plan).toContainText('New Jev evaluations0')
		await page.getByRole('button', { name: 'Start evaluation' }).click()
		await expect(page.getByRole('heading', { name: 'Run 2' })).toBeVisible()
		await expect(page.getByText(/Run complete/)).toBeVisible({ timeout: 45_000 })

		// Results say which run they are, and switch to an earlier one.
		await page.getByRole('link', { name: 'View results' }).click()
		await page.waitForURL('**/results')
		const main = page.locator('#main')
		await expect(main.getByText('Run complete', { exact: true })).toBeVisible()
		await expect(main).toContainText('Run 2 ·')
		await page.getByRole('button', { name: 'Choose a run' }).click()
		await page.getByRole('menuitem', { name: /^Run 1 ·/ }).click()
		await expect(main).toContainText('Run 1 ·')
		await expect(page.getByRole('button', { name: /^Decision threshold 0\.40/ })).toBeVisible()
		await expect(main).toContainText('Run started at 0.50')
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
		await expect(failures).toContainText('Request rejected1 pair')
		const callsBefore = await jevCalls(page, marker)
		await page.getByRole('button', { name: 'Retry 1 failed' }).click()
		await expect.poll(() => jevCalls(page, marker), { timeout: 30_000 }).toBe(callsBefore + 1)
		await expect(page.getByText('1 assessment is incomplete.')).toBeVisible({ timeout: 30_000 })
		await expect(failures).toContainText('Request rejected1 pair')
	})

	test('a rejected API key stops the run with the fix, and it resumes once the key works', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Key problem')
		const marker = await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await expect(page.getByText(/Added 4 pairs/)).toBeVisible()
		await page.request.post(`${JEV_STUB}/reject?marker=${marker}`)

		await page.getByRole('link', { name: 'Continue to rules' }).click()
		await page.waitForURL('**/rules')
		await page.getByRole('button', { name: 'Review plan' }).click()
		await page.waitForURL('**/plan')
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
		await uploadRecords(page, 'invalid-source.csv')
		await expect(page.getByText('Fix these before continuing')).toBeVisible()
		await expect(page.getByText('1 row has no record reference: 4')).toBeVisible()
		await expect(page.getByText('Reference “R1” appears on rows 2, 3')).toBeVisible()

		await page.getByRole('button', { name: 'Replace file' }).click()
		await uploadRecords(page, 'demo-source.csv')
		await page.getByRole('link', { name: 'Continue to vendors' }).click()
		await page.locator('input[type=file]').setInputFiles(`${FIXTURES}/unknown-vendor.csv`)
		await page.getByRole('checkbox').click()
		await page.getByRole('button', { name: 'Add vendor' }).click()
		await expect(
			page.getByText(/1 reference isn’t in the source records: Row 2: “R99”/)
		).toBeVisible()
		await expect(page.getByRole('link', { name: 'Continue to rules' })).toHaveCount(0)
	})

	test('an over-cap plan is blocked with its cause, and a custom rule brings it under', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Over the cap')
		await uploadRecords(page, 'over-cap-source.csv')
		await expect(page.getByText('over-cap-source.csv · 105 records')).toBeVisible()
		await addVendor(page, 'over-cap-vendor.csv')
		await expect(page.getByText(/Added 1 pair/)).toBeVisible()

		await page.getByRole('link', { name: 'Continue to rules' }).click()
		await page.waitForURL('**/rules')
		await expect(page.getByText('This rule alone creates 5,460 pairs').first()).toBeVisible()
		await page.getByRole('button', { name: 'Review plan' }).click()
		await page.waitForURL('**/plan')
		await expect(page.getByText('This plan has 5,460 pairs; one run allows 5,000.')).toBeVisible()
		await expect(
			page.getByText('Same name and postcode: 5,460 pairs (largest group: 105 records)')
		).toBeVisible()
		await expect(page.getByRole('button', { name: 'Start evaluation' })).toBeDisabled()

		await page.getByRole('link', { name: 'Turn off or narrow a rule' }).click()
		await page.waitForURL('**/rules')
		await page.getByRole('switch', { name: 'Same name and postcode' }).click()
		await page.getByText('Add a custom rule').click()
		await page.getByRole('combobox', { name: 'Field 1' }).click()
		await page.getByRole('option', { name: 'Email' }).click()
		await expect(page.getByText('A rule with these fields already exists.')).toBeVisible()
		await page.getByRole('combobox', { name: 'Field 2' }).click()
		await page.getByRole('option', { name: 'Postcode' }).click()
		await expect(page.getByRole('button', { name: 'Add rule' })).toBeEnabled()
		await page.getByRole('button', { name: 'Add rule' }).click()
		await expect(page.getByText('Email + Postcode')).toBeVisible()

		await page.getByRole('button', { name: 'Review plan' }).click()
		await page.waitForURL('**/plan')
		await expect(page.locator('dl')).toContainText('Unique pairs to compare1')
		await expect(page.getByRole('button', { name: 'Start evaluation' })).toBeEnabled()

		// The custom rule was saved with the rest of the configuration.
		await page.goto(page.url().replace(/\/plan$/, '/rules'))
		await expect(page.getByText('Email + Postcode')).toBeVisible()
	})

	test('an unsaved country change is flagged, and saving recounts the presets in place', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Country change')
		await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await page.getByRole('link', { name: 'Continue to rules' }).click()
		await page.waitForURL('**/rules')
		const phoneCard = page.locator('li').filter({ hasText: 'Same phone' })
		const before = await phoneCard.innerText()
		await expect(page.getByText(/Unsaved change/)).toHaveCount(0)

		await page.getByLabel('Country for phone numbers').fill('GB')
		await expect(
			page.getByText(/Unsaved change: the counts below still read phone numbers as US/)
		).toBeVisible()
		await page.getByLabel('Country for phone numbers').fill('us')
		await expect(page.getByText(/Unsaved change/)).toHaveCount(0)

		await page.getByLabel('Country for phone numbers').fill('GB')
		await page.getByRole('button', { name: 'Save and recount' }).click()
		await expect(page.getByText(/Unsaved change/)).toHaveCount(0)
		await expect(page).toHaveURL(/\/rules$/)
		// US numbers don't parse as British ones, so the phone rule's counts change.
		await expect(phoneCard).not.toHaveText(before)
		await page.reload()
		await expect(page.getByLabel('Country for phone numbers')).toHaveValue('GB')
	})

	test('unsaved rule changes are guarded on links, back and unload; saved ones are not', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Unsaved changes')
		await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await page.getByRole('link', { name: 'Continue to rules' }).click()
		await page.waitForURL('**/rules')
		// Stages are links in the sidebar's pipeline, named "<stage>, <state>. <detail>".
		const stepLink = (name: string) =>
			page
				.getByRole('list', { name: 'Pipeline' })
				.getByRole('link', { name: new RegExp(`^${name},`) })
		const dialog = page.getByRole('alertdialog', { name: 'Leave without saving?' })

		// Clean: links just navigate.
		await stepLink('Vendors').click()
		await page.waitForURL('**/vendors')
		await expect(dialog).toHaveCount(0)
		await stepLink('Rules').click()
		await page.waitForURL('**/rules')

		// A link while dirty asks; Stay keeps the edit.
		const nameRule = page.getByRole('switch', { name: 'Same name', exact: true })
		await nameRule.click()
		await stepLink('Vendors').click()
		await expect(dialog).toBeVisible()
		await dialog.getByRole('button', { name: 'Stay on this page' }).click()
		await expect(dialog).toHaveCount(0)
		await expect(page).toHaveURL(/\/rules$/)
		await expect(nameRule).toBeChecked()

		// Back while dirty asks too, and stays until the user chooses to leave.
		await page.goBack()
		await expect(dialog).toBeVisible()
		await expect(page).toHaveURL(/\/rules$/)
		await dialog.getByRole('button', { name: 'Stay on this page' }).click()
		await expect(nameRule).toBeChecked()

		// Closing the tab (or reloading) gets the browser's own prompt;
		// dismissing it keeps the page and the edit.
		const unloadPrompt = page.waitForEvent('dialog')
		await page.close({ runBeforeUnload: true })
		const prompt = await unloadPrompt
		expect(prompt.type()).toBe('beforeunload')
		await prompt.dismiss()
		expect(page.isClosed()).toBe(false)
		await expect(nameRule).toBeChecked()

		// Leave discards the edit.
		await stepLink('Vendors').click()
		await dialog.getByRole('button', { name: 'Leave without saving' }).click()
		await page.waitForURL('**/vendors')
		await stepLink('Rules').click()
		await page.waitForURL('**/rules')
		await expect(nameRule).not.toBeChecked()

		// Saving is not leaving: no dialog, and Back returns to the rules in one step.
		await nameRule.click()
		await page.getByRole('button', { name: 'Review plan' }).click()
		await page.waitForURL('**/plan')
		await expect(dialog).toHaveCount(0)
		await page.goBack()
		await page.waitForURL('**/rules')
		await expect(nameRule).toBeChecked()
	})

	test('two vendors are compared side by side', async ({ page }) => {
		await signUp(page)
		await createEvaluation(page, 'Two vendors')
		await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await expect(page.getByText(/Added 4 pairs/)).toBeVisible()
		await page.locator('input[type=file]').setInputFiles(`${FIXTURES}/demo-vendor-b.csv`)
		await page.getByRole('checkbox').click()
		await page.getByRole('button', { name: 'Add vendor' }).click()
		await expect(page.getByText(/Added 3 pairs/)).toBeVisible()
		await runEvaluation(page)

		// One vendor at a time, switchable; and both side by side.
		await expect(page.getByRole('radio', { name: 'Vendor B' })).toBeVisible()
		const comparison = page.getByRole('region', { name: 'Vendor comparison' })
		await expect(comparison).toBeVisible()
		await comparison.getByRole('button', { name: 'Show as table' }).click()
		await expect(comparison.getByRole('rowheader')).toHaveText(['Vendor A', 'Vendor B'])
		await expect(page.getByRole('region', { name: 'Where vendors agree' })).toBeVisible()
	})

	test('empty states: no evaluations yet, and later steps ask for records first', async ({
		page
	}) => {
		await signUp(page)
		await expect(page.getByRole('heading', { name: 'No evaluations yet' })).toBeVisible()

		await createEvaluation(page, 'Empty states')
		const records = page.url()
		for (const step of ['vendors', 'rules']) {
			await page.goto(records.replace(/\/records$/, `/${step}`))
			await expect(
				page.getByRole('heading', { name: 'Upload the source records first' })
			).toBeVisible()
		}
		await page.getByRole('link', { name: 'Go to records' }).click()
		await page.waitForURL('**/records')
		await expect(page.getByText('Add your source records')).toBeVisible()
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
		await expect(page.getByText('demo-source.csv · 24 records')).toBeVisible()
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

	test('onboarding asks for a full name first, then the account shows it', async ({ page }) => {
		await page.goto('/sign-up')
		await page.getByLabel('Email').fill(`e2e+${Date.now()}-name@pairsight.test`)
		await page.getByLabel('Password').fill(PASSWORD)
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
