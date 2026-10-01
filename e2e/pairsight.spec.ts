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

	function tile(page: Page, name: string) {
		return page.locator('a[aria-pressed]').filter({ hasText: name })
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
		await expect(
			page.getByText(/8 pairs compared — 6 from your rules, 2 added only because a vendor/)
		).toBeVisible()

		await tile(page, 'Vendor only').click()
		await expect(page.getByText('2 pairs')).toBeVisible()

		// From the keyboard: / jumps to search; ↓ then Enter opens the first pair.
		await page.keyboard.press('/')
		await expect(page.getByRole('searchbox', { name: 'Search references or names' })).toBeFocused()
		await page.getByRole('heading', { level: 1 }).click()
		// A short window scrolled down, so coming back has a position to restore.
		await page.setViewportSize({ width: 1280, height: 480 })
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
		await page.keyboard.press('ArrowDown')
		await expect(page.locator('tbody tr a').first()).toBeFocused()
		await page.keyboard.press('Enter')
		await page.waitForURL('**/pairs/**')
		await expect(
			page.getByRole('heading', { name: /Vendor A: match · PairSight: no match/ })
		).toBeVisible()
		await expect(page.getByText('AI judgment — it can be wrong.')).toBeVisible()
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
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
		await page.setViewportSize({ width: 1280, height: 720 })

		// Filters that match nothing: the empty state says so and clears them.
		await page.goto(`${page.url()}&q=no-such-record`)
		const noMatches = page.getByRole('status').filter({ hasText: 'No pairs match these filters' })
		await expect(noMatches).toBeVisible()
		await noMatches.getByRole('link', { name: 'Clear filters' }).click()
		// Clearing keeps the selected vendor, nothing else.
		await page.waitForURL(/\/results(\?vendor=[^&]+)?$/)
		await expect(page.locator('p[aria-live]').filter({ hasText: /pairs?$/ })).toHaveText('8 pairs')
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
		await page.getByLabel('Decision threshold').fill('0.40')
		await expect(page.getByRole('dialog')).toContainText(/PairSight only\s*2 → 3/)
		await page.getByRole('button', { name: 'Apply' }).click()
		// The borderline Bob/Robert Chen pair (stub score 0.45) crosses the new threshold.
		await expect(tile(page, 'PairSight only')).toContainText('3')
		await expect(tile(page, 'Neither matched')).toContainText('1')
		// Re-decided from the saved scores: Jev wasn't asked again.
		expect(await jevCalls(page, marker)).toBe(callsBefore)

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
		await expect(main.getByText('Complete', { exact: true })).toBeVisible()
		await expect(main).toContainText('Run 2 ·')
		await page.getByRole('button', { name: 'Choose a run' }).click()
		await page.getByRole('menuitem', { name: /^Run 1 ·/ }).click()
		await expect(main).toContainText(/Run 1 · .+ · threshold 0\.40/)
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
		await expect(page.getByText(/33% judged — 2 pairs are incomplete/)).toBeVisible()
		await expect(page.getByText('Request rejected').first()).toBeVisible()

		// The status filter keeps judged pairs only (and survives the empty "All" selects).
		await page.getByLabel('Status', { exact: true }).selectOption('evaluated')
		await page.getByRole('button', { name: 'Filters' }).click()
		await expect(page).toHaveURL(/status=evaluated/)
		await expect(page.locator('p[aria-live]').filter({ hasText: /pairs?$/ })).toHaveText('1 pair')
		await page.getByRole('link', { name: 'Clear filters' }).click()
		await expect(page).not.toHaveURL(/status=/)

		// Retrying one pair from its page: Jev judges it this time.
		await tile(page, 'Incomplete').click()
		await page.locator('tbody tr').filter({ hasText: 'Retrycase' }).locator('a').click()
		await page.waitForURL('**/pairs/**')
		await page.getByRole('button', { name: 'Retry this pair' }).click()
		await expect(page.getByText('PairSight decision at this threshold: match')).toBeVisible({
			timeout: 30_000
		})
		await page.getByRole('link', { name: 'Back to results' }).click()
		await page.waitForURL(/\/results\?/)
		await expect(tile(page, 'Incomplete')).toContainText('1')
		await expect(tile(page, 'Both matched')).toContainText('2')

		// Retry failed on the Run page asks Jev again about the pair that's
		// still failed; Failcase fails again and stays incomplete.
		await page.getByRole('link', { name: 'Open run' }).click()
		const failures = page.getByRole('heading', { name: 'Why pairs failed' }).locator('..')
		await expect(failures).toContainText('Request rejected1 pair')
		const callsBefore = await jevCalls(page, marker)
		await page.getByRole('button', { name: 'Retry failed pairs' }).click()
		await expect.poll(() => jevCalls(page, marker), { timeout: 30_000 }).toBe(callsBefore + 1)
		await expect(page.getByText(/1 pair failed/)).toBeVisible({ timeout: 30_000 })
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
		await expect(page.getByRole('link', { name: 'View results' })).toHaveAttribute(
			'aria-disabled',
			'true'
		)

		// The key is fixed; resuming judges every pair.
		await page.request.post(`${JEV_STUB}/accept?marker=${marker}`)
		await page.getByRole('button', { name: 'Resume run' }).click()
		await expect(page.getByText(/Run complete/)).toBeVisible({ timeout: 45_000 })
		await expect(stopped).toHaveCount(0)
		await expect(page.getByText('8 of 8 pairs judged')).toBeVisible()
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
		// Stages are links in the sidebar's pipeline, named "<stage>, <detail>".
		const stepLink = (name: string) =>
			page
				.getByRole('region', { name: 'Pipeline' })
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

		await expect(page.getByRole('heading', { name: 'Agreement by vendor' })).toBeVisible()
		const byVendor = page.getByRole('table', { name: 'Agreement by vendor' })
		await expect(byVendor.getByRole('rowheader')).toHaveText(['Vendor A', 'Vendor B'])
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
		const pipeline = page.getByRole('region', { name: 'Pipeline' })
		await expect(pipeline.getByRole('link', { name: /^Records, upload a CSV/ })).toBeVisible()

		await uploadRecords(page, 'demo-source.csv')
		await expect(page.getByText('demo-source.csv · 24 records')).toBeVisible()
		await expect(pipeline.getByRole('link', { name: /^Records, 24 records/ })).toBeVisible()
		await expect(pipeline.getByRole('link', { name: /^Vendors, add vendor matches/ })).toBeVisible()
		await expect(pipeline.getByText('Setup · 1 of 6 stages')).toBeVisible()

		const shell = page.locator('.app-shell')
		await expect(shell).toHaveAttribute('data-collapsed', 'false')
		await page.getByRole('button', { name: 'Collapse sidebar' }).click()
		await expect(shell).toHaveAttribute('data-collapsed', 'true')
		// The width is remembered, and the server renders it on the first paint.
		await page.reload()
		await expect(shell).toHaveAttribute('data-collapsed', 'true')
		await page.keyboard.press('[')
		await expect(shell).toHaveAttribute('data-collapsed', 'false')
		await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()

		// On phones the same toggle opens a drawer, and says so. (The scrim
		// behind the drawer is also a "Close navigation" button.)
		await page.setViewportSize({ width: 390, height: 844 })
		const toggle = page.locator('button[aria-controls="sidebar"]')
		await expect(toggle).toHaveAccessibleName('Open navigation')
		await expect(toggle).toHaveAttribute('aria-expanded', 'false')
		await toggle.click()
		await expect(shell).toHaveAttribute('data-mobile-open', 'true')
		await expect(toggle).toHaveAccessibleName('Close navigation')
		await expect(toggle).toHaveAttribute('aria-expanded', 'true')
		await page.keyboard.press('Escape')
		await expect(shell).toHaveAttribute('data-mobile-open', 'false')
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
