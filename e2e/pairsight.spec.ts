import { expect, test, type Page } from '@playwright/test'

// The PairSight vertical slice, end to end, against local Supabase and the Jev
// stub (scripts/jev-stub.mjs). Opt in with E2E_PAIRSIGHT=1 — CI's e2e job has
// no database or Supabase, so these are skipped there.

const FIXTURES = 'e2e/fixtures'
const PASSWORD = 'e2e-password-123'

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

	async function uploadRecords(page: Page, file: string) {
		await page.locator('input[type=file]').setInputFiles(`${FIXTURES}/${file}`)
		await expect(page.getByText('Map your columns')).toBeVisible()
		await page.getByRole('button', { name: 'Save records' }).click()
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

		for (const name of ['PairSight only', 'Vendor only', 'Both matched', 'Neither matched']) {
			await expect(tile(page, name)).toContainText('2')
		}
		await expect(tile(page, 'Incomplete')).toContainText('0')
		await expect(
			page.getByText(/8 pairs compared — 6 from your rules, 2 added only because a vendor/)
		).toBeVisible()

		await tile(page, 'Vendor only').click()
		await expect(page.getByText('2 pairs')).toBeVisible()
		await page.locator('tbody tr a').first().click()
		await expect(
			page.getByRole('heading', { name: /Vendor A: match · PairSight: no match/ })
		).toBeVisible()
		await expect(page.getByText('AI judgment — it can be wrong.')).toBeVisible()
		const firstPair = page.url()
		await page.keyboard.press('j')
		await expect(page).not.toHaveURL(firstPair)
		await page.keyboard.press('Escape')
		await page.waitForURL(/\/results\?/)
		await expect(page).toHaveURL(/category=vendor_only/)
	})

	test('changing the threshold re-decides from saved scores; a new run reuses every assessment', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Threshold and reuse')
		await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await runEvaluation(page)

		await page.getByLabel('Decision threshold').fill('0.40')
		await page.getByRole('button', { name: 'Apply' }).click()
		// The borderline Bob/Robert Chen pair (stub score 0.45) crosses the new threshold.
		await expect(tile(page, 'PairSight only')).toContainText('3')
		await expect(tile(page, 'Neither matched')).toContainText('1')

		const evaluationPath = new URL(page.url()).pathname.split('/runs/')[0]
		await page.goto(`${evaluationPath}/plan`)
		const plan = page.locator('dl')
		await expect(plan).toContainText('Already judged in an earlier run (reused)8')
		await expect(plan).toContainText('New Jev evaluations0')
		await page.getByRole('button', { name: 'Start evaluation' }).click()
		await expect(page.getByRole('heading', { name: 'Run 2' })).toBeVisible()
		await expect(page.getByText(/Run complete/)).toBeVisible({ timeout: 45_000 })
	})

	test('failed evaluations stay incomplete — never a nonmatch — and 529s are retried', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Failures')
		await uploadRecords(page, 'failures-source.csv')
		await addVendor(page, 'failures-vendor.csv')
		await runEvaluation(page)

		await expect(tile(page, 'Incomplete')).toContainText('1')
		await expect(tile(page, 'Both matched')).toContainText('1')
		await expect(tile(page, 'Vendor only')).toContainText('0')
		await expect(page.getByText(/1 pair isn’t judged yet or failed/)).toBeVisible()
		await expect(page.getByText('http_422')).toBeVisible()

		await page.getByRole('link', { name: 'Open run' }).click()
		await page.getByRole('button', { name: 'Retry failed pairs' }).click()
		await expect(page.getByText(/1 pair failed/)).toBeVisible({ timeout: 45_000 })
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
