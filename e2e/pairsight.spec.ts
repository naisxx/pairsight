import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { failOnCspViolations } from './csp'
import { padded } from './padding'
import { readPdfText } from './pdf'
import {
	exportFindings,
	fixtureWorkbook,
	readWorkbook,
	workbookFromCsv,
	XLSX_MIME
} from './workbooks'

failOnCspViolations()

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

	// The records as a file to upload, with each email moved to its own domain
	// (see uploadRecords), padded past the 200 records PairSight learns from.
	function markedRecords(file: string) {
		const marker = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
		const csv = padded(
			readFileSync(`${FIXTURES}/${file}`, 'utf8').replace(
				/@example\.com/gi,
				`@${marker}.example.com`
			)
		)
		return { marker, csv }
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
		const { marker, csv } = markedRecords(file)
		await page
			.locator('input[type=file]')
			.setInputFiles({ name: file, mimeType: 'text/csv', buffer: Buffer.from(csv) })
		await expect(page.getByText(/^We matched \d+ fields? to your/)).toBeVisible()
		if (save) {
			// Saving continues to Vendors.
			await page.getByRole('button', { name: 'Next: vendors' }).click()
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
		await expect(page.getByText(/^Upload Vendor [A-C]’s file/)).toBeVisible()
		await page.locator('input[type=file]').setInputFiles(`${FIXTURES}/${file}`)
		const complete = page.getByRole('checkbox', { name: /^Yes, this file has all of/ })
		// Checking the file builds and keeps every pair it implies: near the
		// 100K limit that outlasts the default few seconds when the database
		// is busy, while the page says it's still checking.
		await expect(complete).toBeEnabled({ timeout: 30_000 })
		await complete.click()
		// Confirming saves every pair the file matched: a 100K-pair file takes
		// more than the default few seconds when the database is busy.
		await expect(complete).toBeChecked({ timeout: 30_000 })
		await expect(complete).toBeDisabled()
	}

	// The selected vendor's matched-pair count.
	async function expectVendorPairs(page: Page, count: number) {
		await expect(page.getByLabel('What’s in the file')).toContainText(
			new RegExp(`Matched pairs\\s*${count}(?!\\d)`)
		)
	}

	// Rules save themselves; the plan opens once they have.
	// Opens the plan once PairSight has worked out the pairs to check (it
	// does that in the background, after the records are saved).
	async function reviewPlan(page: Page) {
		await expect(page.getByText('Saved', { exact: true })).toBeVisible()
		await page.getByRole('link', { name: 'Check and start', exact: true }).click()
		await page.waitForURL('**/plan')
		await expect(page.getByText('Still looking at your records…')).toHaveCount(0, {
			timeout: 60_000
		})
	}

	// Start opens the Runs centre on the new run. When it's done, the centre
	// moves it to Completed and takes you to its results; Escape closes it.
	async function startRun(page: Page) {
		await page.getByRole('button', { name: 'Start run' }).click()
		const runs = page.getByRole('dialog', { name: 'Runs' })
		await expect(runs).toBeVisible()
		await page.waitForURL(/\/runs\/[0-9a-f-]+\/results/, { timeout: 45_000 })
		await expect(runs.getByRole('radio', { name: /^Completed/ })).toBeChecked()
		// Finished: complete, or with the pairs Jev couldn't judge called out.
		await expect(
			runs.getByText(/^(Complete|Finished, \d+ pairs? couldn’t be checked) · Started/).first()
		).toBeVisible()
		await page.keyboard.press('Escape')
		await expect(runs).toHaveCount(0)
		// The top bar caught up too: not still "Running" behind the dialog.
		const status = page.getByRole('banner').getByText(/^(Running|Complete|Needs attention)$/)
		await expect(status).toHaveText(/^(Complete|Needs attention)$/)
	}

	async function runEvaluation(page: Page) {
		await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
		await page.waitForURL('**/rules')
		await reviewPlan(page)
		await startRun(page)
	}

	// The Overview's category tiles; each opens its pairs in the detailed view.
	function tile(page: Page, name: string) {
		return page
			.getByRole('region', { name: 'Pairs by who says what', exact: true })
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
		await expect(
			page.getByRole('heading', { name: 'Ready to check your first vendor?' })
		).toBeVisible()
		await createEvaluation(page, 'Dashboard check')
		await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await expectVendorPairs(page, 4)
		await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
		await reviewPlan(page)
		await startRun(page)

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
		await expect(summary).toContainText(/Pairs checked\s*8/)

		// 2 both matched, 2 vendor only, 2 PairSight only: 50% precision and recall.
		const latest = page.getByRole('region', { name: 'Dashboard check' })
		await expect(latest.getByRole('row', { name: /Vendor A/ })).toContainText('50.0%')
		await latest.getByRole('link', { name: '4 disagreements for Vendor A' }).click()
		await page.waitForURL(/category=disagreements/)
		await expect(matching(page)).toHaveText('4 pairs')
		await page.goto('/evaluations')

		// Setup picks up where it stopped: records still to upload.
		const continueSetup = page.getByRole('region', { name: 'Pick up where you left off' })
		await expect(continueSetup.getByRole('link', { name: /Still in setup/ })).toHaveAttribute(
			'href',
			/\/records$/
		)

		await page.getByRole('button', { name: 'Actions for Still in setup' }).click()
		await page.getByRole('menuitem', { name: 'Rename' }).click()
		const rename = page.getByRole('dialog', { name: 'Rename this evaluation' })
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

	// Uploads a fixture as-is and waits for the type picker and the mapping.
	async function uploadFile(page: Page, file: string) {
		await page.locator('input[type=file]').setInputFiles({
			name: file,
			mimeType: 'text/csv',
			buffer: Buffer.from(padded(readFileSync(`${FIXTURES}/${file}`, 'utf8')))
		})
		await expect(page.getByText(/^We matched \d+ fields? to your/)).toBeVisible()
	}

	test('organisations: detected from the columns, their pairs picked and judged as organisations', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Supplier check')
		await uploadFile(page, 'company-source.csv')
		await expect(page.getByText('These look like organisations')).toBeVisible()
		await expect(page.getByRole('radio', { name: /^Organisations/ })).toBeChecked()
		await page.getByRole('button', { name: 'Next: vendors' }).click()
		await page.waitForURL('**/vendors')
		await addVendor(page, 'company-vendor.csv')
		await expectVendorPairs(page, 4)

		await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
		await page.waitForURL('**/rules')
		// PairSight picks the pairs the way it does for organisations.
		await expect(page.getByRole('region', { name: 'The pairs Jev will check' })).toContainText(
			'most likely to be the same organisation'
		)
		await expect(page.getByLabel('When are two records the same?', { exact: true })).toHaveValue(
			/same organisation/
		)
		await reviewPlan(page)
		await startRun(page)

		// A rebrand and a trading name the vendor missed; a subsidiary, a
		// same-name company and a shared address it wrongly merged.
		await expect(tile(page, 'Both say same')).toContainText('1')
		await expect(tile(page, 'Only Jev says same')).toContainText('2')
		await expect(tile(page, 'Only vendor says same')).toContainText('3')
		await expect(tile(page, 'Both say different')).toContainText('0')
		await tile(page, 'Only vendor says same').click()
		await page.waitForURL(/tab=detailed/)
		// Records are named by the organisation's name.
		await expect(page.getByRole('table').getByText('Orbis Logistics Ltd')).toBeVisible()
	})

	test('products: detected from the columns, their pairs picked, variants kept apart', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Catalogue check')
		await uploadFile(page, 'product-source.csv')
		await expect(page.getByText('These look like products')).toBeVisible()
		// Switching type suggests that type's fields; switching back restores them.
		await page.getByRole('radio', { name: /^People/ }).click()
		await expect(page.getByRole('radio', { name: /^People/ })).toBeChecked()
		await page.getByRole('radio', { name: /^Products/ }).click()
		await page.getByRole('button', { name: 'Next: vendors' }).click()
		await page.waitForURL('**/vendors')
		await addVendor(page, 'product-vendor.csv')
		await expectVendorPairs(page, 3)

		await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
		await page.waitForURL('**/rules')
		await expect(page.getByRole('region', { name: 'The pairs Jev will check' })).toContainText(
			'most likely to be the same product'
		)
		await reviewPlan(page)
		await startRun(page)

		// One duplicate both found; two the vendor missed (one item under a UPC
		// and an EAN); a size and a brand it wrongly merged. A colour variant
		// nobody merged isn't even suggested: another colour is another product.
		await expect(tile(page, 'Both say same')).toContainText('1')
		await expect(tile(page, 'Only Jev says same')).toContainText('2')
		await expect(tile(page, 'Only vendor says same')).toContainText('2')
		await expect(tile(page, 'Both say different')).toContainText('0')
		await tile(page, 'Both say same').click()
		await page.waitForURL(/tab=detailed/)
		// Products are named by brand and name.
		await expect(
			page.getByRole('table').getByText('Kestrel Kestrel Pro USB-C Hub').first()
		).toBeVisible()
	})

	test('a 10,000-record file uploads once, is checked and saved; a bigger file is refused plainly', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Big file')
		const input = page.locator('input[type=file]')

		// Over the size limit: said plainly, before anything is sent.
		await input.setInputFiles({
			name: 'too-big.csv',
			mimeType: 'text/csv',
			buffer: Buffer.alloc(10_000_001, 'a')
		})
		await expect(page.getByText(/^The file is bigger than 10 MB/)).toBeVisible()

		// 10,000 fictional people, at the record limit.
		const lines = ['record_id,first_name,last_name,email,date_of_birth']
		for (let index = 1; index <= 10_000; index++) {
			lines.push(
				`P${String(index).padStart(5, '0')},Test${index},Person${index % 977},p${index}@big.example.test,19${50 + (index % 50)}-0${1 + (index % 9)}-1${index % 10}`
			)
		}
		const uploads: string[] = []
		page.on('request', (request) => {
			if (request.method() === 'PUT' && request.url().includes('/uploads')) {
				uploads.push(request.url())
			}
		})
		await input.setInputFiles({
			name: 'people-10k.csv',
			mimeType: 'text/csv',
			buffer: Buffer.from(lines.join('\n'))
		})
		await expect(page.getByText(/^We matched \d+ fields? to your/)).toBeVisible({ timeout: 30_000 })
		// The row count is shortened, exact on hover.
		const rows = page.getByLabel('File details').getByText('10K', { exact: true })
		await expect(rows).toHaveAttribute('title', '10,000')
		await page.getByRole('button', { name: 'Next: vendors' }).click()
		await page.waitForURL('**/vendors', { timeout: 60_000 })
		expect(uploads).toHaveLength(1)
		await expect(page.getByRole('navigation').getByText('10K records')).toBeVisible()
	})

	test('a file too small to learn from is refused, and says how many it needs', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Too small')
		// The fixture as it is: 24 records, without the padding other tests add.
		await page.locator('input[type=file]').setInputFiles({
			name: 'demo-source.csv',
			mimeType: 'text/csv',
			buffer: readFileSync(`${FIXTURES}/demo-source.csv`)
		})
		await expect(
			page.getByText(
				'The file has 24 records. PairSight needs at least 200 to learn what a duplicate looks like in your data, so it can pick the pairs worth checking.'
			)
		).toBeVisible()
	})

	test('Excel in and out: a workbook’s sheet is picked, and findings export as a workbook', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Excel scenario')

		// A workbook with a notes tab ahead of the records: PairSight asks which to read.
		const { csv } = markedRecords('demo-source.csv')
		const records = await workbookFromCsv(csv, {
			sheet: 'Customers',
			before: { Notes: [['Fictional records'], ['Exported for an e2e test']] }
		})
		// The file goes up once; picking a sheet reads it from there.
		const uploads: string[] = []
		page.on('request', (request) => {
			if (request.method() === 'PUT' && request.url().includes('/uploads')) {
				uploads.push(request.url())
			}
		})
		await page
			.locator('input[type=file]')
			.setInputFiles({ name: 'demo-source.xlsx', mimeType: XLSX_MIME, buffer: records })
		const picker = page.getByRole('region', { name: 'Which sheet should we read?' })
		await expect(picker).toContainText('demo-source.xlsx has 2 sheets with data')
		await expect(picker.getByRole('button', { name: /^Notes/ })).toContainText('1 row')
		await picker.getByRole('button', { name: /^Customers/ }).click()
		await expect(page.getByText(/^We matched \d+ fields? to your/)).toBeVisible()
		await expect(page.getByText('Not saved yet · Excel · Sheet Customers')).toBeVisible()
		expect(uploads).toHaveLength(1)
		// Dates and numbers read as written: 1990-04-12, not a serial number.
		await page.getByRole('button', { name: 'Preview rows' }).click()
		await expect(page.getByRole('table').first()).toContainText('1990-04-12')
		await page.getByRole('button', { name: 'Next: vendors' }).click()
		await page.waitForURL('**/vendors')

		await page.getByRole('button', { name: 'Add vendor' }).click()
		await page.locator('input[type=file]').setInputFiles({
			name: 'demo-vendor-a.xlsx',
			mimeType: XLSX_MIME,
			buffer: await fixtureWorkbook(`${FIXTURES}/demo-vendor-a.csv`, 'Matches')
		})
		await expectVendorPairs(page, 4)
		await expect(page.getByText(/· Excel · Sheet Matches$/)).toBeVisible()
		await page.getByRole('checkbox', { name: /^Yes, this file has all of/ }).click()
		await runEvaluation(page)

		// The same results as the CSV upload of the same records.
		for (const name of [
			'Only Jev says same',
			'Only vendor says same',
			'Both say same',
			'Both say different'
		]) {
			await expect(tile(page, name)).toContainText('2')
		}

		const download = await exportFindings(page, 1, /^Excel/)
		expect(download.suggestedFilename()).toBe('pairsight-excel-scenario-run-1-findings.xlsx')
		const findings = await readWorkbook(await download.path())
		expect(findings.name).toBe('Findings')
		expect(findings.isHeaderBold).toBe(true)
		expect(findings.isHeaderFrozen).toBe(true)
		expect(findings.header.slice(0, 2)).toEqual(['Record A', 'Record B'])
		expect(findings.rows).toHaveLength(8)
		const category = findings.header.indexOf('Vendor A: group')
		for (const name of [
			'Only Jev says same',
			'Only vendor says same',
			'Both say same',
			'Both say different'
		]) {
			expect(findings.rows.filter((row) => row[category] === name)).toHaveLength(2)
		}
		// Jev's score is a number in Excel, not text.
		expect(typeof findings.cell(2, findings.header.indexOf('Jev score') + 1)).toBe('number')
	})

	test('upload to comparison: all four categories, vendor pairs PairSight didn’t suggest, inspection', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Demo scenario')
		await uploadRecords(page, 'demo-source.csv')
		await expect(
			page
				.getByRole('list', { name: 'Steps' })
				.getByRole('link', { name: /^Records, completed\. 220 records/ })
		).toBeVisible()
		await addVendor(page, 'demo-vendor-a.csv')
		await expectVendorPairs(page, 4)

		await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
		await reviewPlan(page)
		const plan = page.getByRole('region', { name: 'From records to pairs' })
		await expect(plan).toContainText(/Pairs Jev will check\s*8/)
		// All 4 vendor pairs are checked; PairSight suggested 3 of them too.
		await expect(plan).toContainText(/Pairs PairSight suggested\s*7/)
		await expect(plan).toContainText(/Pairs your vendors matched\s*\+4/)
		await expect(plan).toContainText('3 vendor pairs PairSight suggested too, counted once')
		await startRun(page)

		for (const name of [
			'Only Jev says same',
			'Only vendor says same',
			'Both say same',
			'Both say different'
		]) {
			await expect(tile(page, name)).toContainText('2')
		}
		// Every pair was checked, so there's no "Not checked yet" to open.
		await expect(tile(page, 'Not checked yet')).toHaveCount(0)
		// Coverage: 7 pairs PairSight suggested, 1 added only because the vendor matched it.
		const coverage = page.getByRole('region', { name: 'What did Jev check?' })
		await expect(coverage).toContainText(/Suggested by PairSight\s*7/)
		await expect(coverage).toContainText(/Added because a vendor matched it\s*1/)

		// Export: every pair in one CSV, with the vendor's decision and category
		// beside Jev's, matching the tiles above.
		const download = await exportFindings(page, 1, /^CSV/)
		expect(download.suggestedFilename()).toBe('pairsight-demo-scenario-run-1-findings.csv')
		// trim() also drops the byte-order mark the file starts with.
		const csv = readFileSync(await download.path(), 'utf8')
		const [header, ...lines] = csv.trim().split('\r\n')
		expect(header).toContain('Record A,Record B')
		expect(header).toContain('Vendor A says,Vendor A: group')
		expect(lines).toHaveLength(8)
		for (const category of [
			'Only Jev says same',
			'Only vendor says same',
			'Both say same',
			'Both say different'
		]) {
			expect(lines.filter((line) => line.endsWith(`,${category}`))).toHaveLength(2)
		}
		// Someone else (here, signed out) can't download it.
		const outsider = await page.context().browser()?.newContext()
		const runId = new URL(page.url()).pathname.split('/runs/')[1]?.split('/')[0]
		const denied = await outsider?.request.get(`/api/runs/${runId}/findings`)
		expect(denied?.status()).toBe(404)
		const deniedSummary = await outsider?.request.get(`/api/runs/${runId}/summary`)
		expect(deniedSummary?.status()).toBe(404)
		await outsider?.close()

		// The summary report: the verdict for the one vendor, its scorecard and the
		// method, with the caveats that keep the numbers honest.
		const summary = await exportFindings(page, 1, /^Summary report/)
		expect(summary.suggestedFilename()).toBe('pairsight-demo-scenario-run-1-summary.pdf')
		// The file is prepared first; a toast says when the download starts.
		await expect(
			page.getByText('pairsight-demo-scenario-run-1-summary.pdf', { exact: true })
		).toBeVisible()
		const report = await readPdfText(await summary.path())
		expect(report).toContain('Demo scenario · Run 1')
		expect(report).toContain('On these 220 records, Vendor A agreed with Jev')
		expect(report).toContain('2 wrong merges')
		expect(report).toContain('Agreement with Jev, an AI · checked pairs only')
		expect(report).toContain('Human review None. Every answer here is Jev’s.')

		await tile(page, 'Only vendor says same').click()
		await page.waitForURL(/tab=detailed/)
		await expect(matching(page)).toHaveText('2 pairs')

		// From the keyboard: / jumps to search; ↓ moves the selection, the pair
		// shows beside the list, and Enter opens the selected one on its own page.
		await page.keyboard.press('/')
		await expect(page.getByRole('searchbox', { name: 'Search by name or record ID' })).toBeFocused()
		// Click away from the search so the arrow keys reach the list.
		await matching(page).click()
		// A short window scrolled down, so coming back has a position to restore.
		await page.setViewportSize({ width: 1280, height: 480 })
		// The page scrolls inside the shell's <main>, not the window.
		await page.evaluate(() => {
			const main = document.getElementById('main')
			main?.scrollTo(0, main.scrollHeight)
		})
		await page.keyboard.press('ArrowDown')
		await expect(page.locator('tbody tr a').first()).toBeFocused()
		const panel = page.getByRole('complementary', { name: 'The selected pair' })
		await expect(panel.getByRole('region', { name: 'Who says what' })).toContainText(
			/Vendor A\s*Same/
		)
		await page.keyboard.press('Enter')
		await page.waitForURL('**/pairs/**')
		// Vendor only: the vendor matched it, PairSight didn't.
		const decisions = page.getByRole('region', { name: 'Who says what' })
		await expect(decisions).toContainText(/Vendor A\s*Same/)
		await expect(decisions).toContainText(/Jev\s*Different/)
		await expect(page.getByText(/Jev is an AI and can be wrong/)).toBeVisible()
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
		await expect(page.getByRole('heading', { name: 'No pairs match that' })).toBeVisible()
		await page.getByRole('link', { name: 'Clear filters' }).click()
		// Clearing keeps the vendor and the detailed view, nothing else.
		await page.waitForURL(/\/results\?vendor=[^&]+&tab=detailed$/)
		await expect(matching(page)).toHaveText('8 pairs')
	})

	test('the match cut-off is set in What Jev checks; a new run at it reuses every saved score', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Threshold and reuse')
		const marker = await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await runEvaluation(page)
		const callsBefore = await jevCalls(page, marker)
		expect(callsBefore).toBeGreaterThan(0)

		// The Overview previews another cut-off live, but a run keeps its own:
		// no Apply. At 0.40 the borderline pair (0.45) counts as the same.
		// The cut-off drawer hangs under the tabs; its tab opens it.
		await page.getByRole('button', { name: /^Match cut-off 0\.50/ }).click()
		const slider = page.getByRole('slider', { name: 'Match cut-off' })
		await slider.focus()
		// Page Down moves it 0.10: from 0.50 to 0.40.
		await page.keyboard.press('PageDown')
		await expect(slider).toHaveAttribute('aria-valuetext', '0.40')
		await expect(tile(page, 'Only Jev says same')).toContainText('3')
		await expect(page.getByRole('button', { name: 'Apply' })).toHaveCount(0)
		await page.getByRole('button', { name: 'Reset to 0.50' }).click()
		await expect(slider).toHaveAttribute('aria-valuetext', '0.50')
		await expect(tile(page, 'Only Jev says same')).toContainText('2')
		await page.getByRole('link', { name: 'Change in What Jev checks' }).click()
		await page.waitForURL('**/rules')

		// Rules: a custom value, then a preset; either saves itself.
		const threshold = page.getByRole('radiogroup', { name: 'How sure must Jev be?' })
		await expect(threshold.getByRole('radio', { name: /^Balanced/ })).toBeChecked()
		await threshold.getByRole('radio', { name: 'Custom' }).click()
		const custom = page.getByLabel('Cut-off', { exact: true })
		await custom.fill('0.62')
		await custom.press('Enter')
		await expect(page.getByText('Pairs Jev scores 0.62 or more count as a match.')).toBeVisible()
		await threshold.getByRole('radio', { name: /^Lenient/ }).click()
		await expect(threshold.getByRole('radio', { name: /^Lenient/ })).toBeChecked()

		// The plan shows it, and nothing needs Jev again.
		await reviewPlan(page)
		const side = page.getByRole('region', { name: 'Match cut-off' })
		await expect(side).toContainText(/0\.35\s*Lenient/)
		const plan = page.getByRole('region', { name: 'From records to pairs' })
		await expect(plan).toContainText(/Already checked\s*8/)
		await expect(plan).toContainText(/New checks by Jev\s*0\s*About \$0\.00/)
		// Every score was reused, so it's complete at once: straight to its results.
		await startRun(page)

		// The borderline Bob/Robert Chen pair (stub score 0.45) is a match at 0.35,
		// decided from the saved scores: Jev wasn't asked again.
		await expect(page.getByRole('button', { name: /^Match cut-off 0\.35/ })).toBeVisible()
		await expect(tile(page, 'Only Jev says same')).toContainText('3')
		await expect(tile(page, 'Both say different')).toContainText('1')
		expect(await jevCalls(page, marker)).toBe(callsBefore)

		// Results say which run they are; the first still decides at its own 0.50.
		const main = page.locator('#main')
		await expect(main.getByText('Run complete', { exact: true })).toBeVisible()
		await expect(main).toContainText('Run 2 ·')
		await page.getByRole('button', { name: 'Choose a run' }).click()
		await page.getByRole('menuitem', { name: /^Run 1 ·/ }).click()
		await expect(main).toContainText('Run 1 ·')
		await expect(page.getByRole('button', { name: /^Match cut-off 0\.50/ })).toBeVisible()
		await expect(tile(page, 'Only Jev says same')).toContainText('2')
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
		await expect(tile(page, 'Not checked yet')).toContainText('2')
		await expect(tile(page, 'Both say same')).toContainText('1')
		await expect(tile(page, 'Only vendor says same')).toContainText('0')
		await expect(page.locator('#main').getByText('2 not checked', { exact: true })).toBeVisible()
		await expect(page.getByText('Not final yet')).toBeVisible()

		// The status filter keeps judged pairs only, applied as it changes.
		await page.getByRole('link', { name: /^Detailed analysis/ }).click()
		await page.waitForURL(/tab=detailed/)
		await page.getByRole('button', { name: 'Filters' }).click()
		await page.getByRole('combobox', { name: 'Checked?' }).click()
		await page.getByRole('option', { name: 'Checked', exact: true }).click()
		await expect(page).toHaveURL(/status=evaluated/)
		await expect(matching(page)).toHaveText('1 pair')
		await page.getByRole('button', { name: 'Clear filters' }).click()
		await expect(page).not.toHaveURL(/status=/)
		await page.getByRole('link', { name: /^Overview/ }).click()
		await page.waitForURL(/\/results\?vendor=[^&]+$/)

		await tile(page, 'Not checked yet').click()
		await page.waitForURL(/category=incomplete/)
		// The list says it couldn't be checked; the panel beside it says why.
		await expect(page.getByRole('table')).toContainText('Couldn’t check')
		await expect(page.getByRole('complementary', { name: 'The selected pair' })).toContainText(
			'Jev couldn’t read this pair'
		)
		// Retrying one pair from the panel beside the list: Jev judges it this time.
		const panel = page.getByRole('complementary', { name: 'The selected pair' })
		await page.locator('tbody tr').filter({ hasText: 'Retrycase' }).locator('a').click()
		await page.waitForURL(/sel=/)
		await panel.getByRole('button', { name: 'Check this pair again' }).click()
		await expect(panel.getByRole('region', { name: 'Who says what' })).toContainText(/Jev\s*Same/, {
			timeout: 30_000
		})

		// Failcase fails again when it's retried.
		const rowCalls = await jevCalls(page, marker)
		await page.locator('tbody tr').filter({ hasText: 'Failcase' }).locator('a').click()
		await expect(panel).toContainText(/failcase\.doe@/)
		await panel.getByRole('button', { name: 'Check this pair again' }).click()
		await expect(
			page.getByText('Jev couldn’t check it this time either.', { exact: false })
		).toBeVisible({
			timeout: 30_000
		})
		expect(await jevCalls(page, marker)).toBe(rowCalls + 1)
		await page.getByRole('link', { name: /^Overview/ }).click()
		await expect(tile(page, 'Not checked yet')).toContainText('1')
		await expect(tile(page, 'Both say same')).toContainText('2')

		// Retry failed from the run's card in the Runs centre asks Jev again about
		// the pair that's still failed; Failcase fails again and stays incomplete.
		await page.getByRole('button', { name: 'Runs', exact: true }).click()
		const runs = page.getByRole('dialog', { name: 'Runs' })
		await expect(runs.getByRole('radio', { name: /^Completed/ })).toBeChecked()
		const card = runs.getByRole('article', { name: 'Run 1 · Failures' })
		await card.getByRole('button', { name: 'Details' }).click()
		await expect(card).toContainText('Jev couldn’t read this pair · 1')
		const callsBefore = await jevCalls(page, marker)
		await card.getByRole('button', { name: 'Try 1 again' }).click()
		await expect.poll(() => jevCalls(page, marker), { timeout: 30_000 }).toBe(callsBefore + 1)
		await expect(runs.getByRole('radio', { name: /^Completed/ })).toBeChecked({ timeout: 30_000 })
		await expect(card).toContainText('Finished, 1 pair couldn’t be checked')
	})

	test('a later run checking a shared pair again updates an earlier finished run’s numbers', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Shared checks')
		await uploadRecords(page, 'failures-source.csv')
		await addVendor(page, 'failures-vendor.csv')
		await runEvaluation(page)
		// Run 1's numbers are worked out once it finishes: two pairs not checked.
		await expect(tile(page, 'Not checked yet')).toContainText('2')
		await expect(tile(page, 'Both say same')).toContainText('1')

		// Run 2, at another cut-off, shares run 1's checks and tries its failed
		// pairs again: Retrycase is judged this time, Failcase fails again.
		await page.getByRole('button', { name: /^Match cut-off 0\.50/ }).click()
		await page.getByRole('link', { name: 'Change in What Jev checks' }).click()
		await page.waitForURL('**/rules')
		const threshold = page.getByRole('radiogroup', { name: 'How sure must Jev be?' })
		await threshold.getByRole('radio', { name: /^Lenient/ }).click()
		await expect(threshold.getByRole('radio', { name: /^Lenient/ })).toBeChecked()
		await reviewPlan(page)
		await startRun(page)
		const main = page.locator('#main')
		await expect(main).toContainText('Run 2 ·')
		await expect(tile(page, 'Not checked yet')).toContainText('1')

		// Run 1 counts the new check too, though it finished before it.
		await page.getByRole('button', { name: 'Choose a run' }).click()
		await page.getByRole('menuitem', { name: /^Run 1 ·/ }).click()
		await expect(main).toContainText('Run 1 ·')
		await expect(page.getByRole('button', { name: /^Match cut-off 0\.50/ })).toBeVisible()
		await expect(tile(page, 'Not checked yet')).toContainText('1')
		await expect(tile(page, 'Both say same')).toContainText('2')
	})

	test('a rejected API key stops the run with the fix, and it resumes once the key works', async ({
		page
	}) => {
		// A refused key is tried for about a minute (a gateway can blip) first.
		test.slow()
		await signUp(page)
		await createEvaluation(page, 'Key problem')
		const marker = await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await expectVendorPairs(page, 4)
		await page.request.post(`${JEV_STUB}/reject?marker=${marker}`)

		await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
		await page.waitForURL('**/rules')
		await reviewPlan(page)
		await page.getByRole('button', { name: 'Start run' }).click()
		// A stopped run is in Completed, marked as failed, with the reason and the fix.
		const runs = page.getByRole('dialog', { name: 'Runs' })
		const card = runs.getByRole('article', { name: 'Run 1 · Key problem' })
		await expect(card.getByRole('alert')).toContainText('its access key was refused', {
			timeout: 120_000
		})
		await expect(runs.getByRole('radio', { name: /^Completed/ })).toBeChecked()
		await expect(card).toContainText('Stopped · Started')
		// Stopped, the one way forward is Resume; results wait for a finished run.
		await expect(card.getByRole('link', { name: 'View results' })).toHaveCount(0)
		await expect(page).toHaveURL(/\/plan$/)

		// The key is fixed; resuming judges every pair.
		await page.request.post(`${JEV_STUB}/accept?marker=${marker}`)
		await card.getByRole('button', { name: 'Resume' }).click()
		await expect(card).toContainText(/^Run 1 · Key problemComplete · Started/, { timeout: 45_000 })
		await expect(card.getByRole('alert')).toHaveCount(0)
		await expect(card).toContainText('8 pairs')
		await expect(card.getByRole('link', { name: 'View results' })).toBeVisible()
	})

	// Sets up an evaluation up to its plan: records, one vendor, the default
	// rules. Returns the upload's marker, for the stub's per-test switches.
	async function readyToStart(page: Page, name: string) {
		await signUp(page)
		await createEvaluation(page, name)
		const marker = await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await expectVendorPairs(page, 4)
		await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
		await page.waitForURL('**/rules')
		await reviewPlan(page)
		return marker
	}

	test('a run keeps going with the page closed, and is finished when you come back', async ({
		context,
		page
	}) => {
		await readyToStart(page, 'Background run')
		const evaluation = page.url().replace(/\/plan$/, '')
		await page.getByRole('button', { name: 'Start run' }).click()
		await expect(page.getByRole('dialog', { name: 'Runs' })).toBeVisible()
		// Nothing on screen follows it any more: the server runs it alone.
		await page.close()

		const later = await context.newPage()
		// Opening the evaluation lands on its results once the run is complete.
		await expect
			.poll(
				async () => {
					await later.goto(evaluation)
					return later.url()
				},
				{ timeout: 30_000, intervals: [1_000] }
			)
			.toMatch(/\/runs\/[0-9a-f-]+\/results/)
		await expect(tile(later, 'Both say same')).toBeVisible()
	})

	test('a run can be paused part-way and resumed', async ({ page }) => {
		const marker = await readyToStart(page, 'Pause and resume')
		// Jev answers slowly for this test's records, so the run is still going.
		await page.request.post(`${JEV_STUB}/slow?marker=${marker}`)
		await page.getByRole('button', { name: 'Start run' }).click()
		const runs = page.getByRole('dialog', { name: 'Runs' })
		const card = runs.getByRole('article', { name: 'Run 1 · Pause and resume' })
		await card.getByRole('button', { name: 'Pause run' }).click()
		await expect(card).toContainText('You paused this run', { timeout: 15_000 })
		await expect(runs.getByRole('radio', { name: /^Completed/ })).toBeChecked()
		await expect(card).toContainText('Paused · Started')
		await expect(card.getByRole('link', { name: 'View results' })).toHaveCount(0)

		// Results wait for a finished run: how far it got, no numbers.
		await page.keyboard.press('Escape')
		await page
			.getByRole('list', { name: 'Steps' })
			.getByRole('link', { name: /^Results,/ })
			.click()
		await page.waitForURL(/\/runs\/[0-9a-f-]+\/results/)
		const notFinished = page.getByRole('region', { name: 'This run is paused' })
		await expect(notFinished).toContainText(/pairs checked so far/)
		await expect(page.getByText('Correct merges')).toHaveCount(0)
		await expect(page.getByRole('button', { name: 'Download' })).toHaveCount(0)

		// Resumed from there, it finishes and the results replace the progress.
		await page.request.post(`${JEV_STUB}/fast?marker=${marker}`)
		await notFinished.getByRole('button', { name: 'Open Runs' }).click()
		await card.getByRole('button', { name: 'Resume' }).click()
		await expect(card).toContainText(/^Run 1 · Pause and resumeComplete · Started/, {
			timeout: 30_000
		})
		await expect(card).toContainText('8 pairs')
		await page.keyboard.press('Escape')
		await expect(tile(page, 'Both say same')).toBeVisible()
	})

	test('another tab notices a run started elsewhere', async ({ context, page }) => {
		const marker = await readyToStart(page, 'Two tabs')
		await page.request.post(`${JEV_STUB}/slow?marker=${marker}`)
		const other = await context.newPage()
		await other.goto('/evaluations')
		await page.getByRole('button', { name: 'Start run' }).click()

		// The other tab never started anything, yet follows the run.
		await other.getByRole('button', { name: /^Runs/ }).click()
		const runs = other.getByRole('dialog', { name: 'Runs' })
		await expect(runs.getByRole('article', { name: 'Run 1 · Two tabs' })).toContainText(
			'Checking pairs'
		)
		await page.request.post(`${JEV_STUB}/fast?marker=${marker}`)
		await expect(runs.getByRole('article', { name: 'Run 1 · Two tabs' })).toContainText(
			'Complete · Started',
			{ timeout: 30_000 }
		)
	})

	test('invalid references are blocked with row numbers', async ({ page }) => {
		await signUp(page)
		await createEvaluation(page, 'Validation')
		await uploadRecords(page, 'invalid-source.csv', { save: false })
		// Checked as soon as the reference column is chosen: one missing, one repeated.
		const validation = page.getByRole('region', { name: 'Do the IDs look right?' })
		await expect(validation).toContainText('2 ID problems')
		await expect(validation).toContainText(/Row 4\s*·\s*Missing ID/)
		await expect(validation).toContainText(/Rows 2, 3\s*·\s*Same ID twice\s*R1/)
		await expect(page.getByRole('button', { name: 'Next: vendors' })).toBeDisabled()
		await expect(page.getByText('Fix 2 ID problems')).toBeVisible()

		await page.getByRole('button', { name: 'Replace file' }).click()
		await uploadRecords(page, 'demo-source.csv')

		// Saved, the file reads back with its mapping; replacing it asks first.
		await page.goto(page.url().replace(/\/vendors$/, '/records'))
		await expect(page.getByLabel('File details')).toContainText(/We matched \d+ fields? to your/)
		await expect(page.getByLabel('File details')).toContainText('demo-source.csv')
		await page.getByRole('button', { name: 'Replace file' }).click()
		const replace = page.getByRole('dialog', { name: 'Use a different file?' })
		await replace.getByRole('button', { name: 'No, keep this one' }).click()
		await expect(page.getByLabel('File details')).toContainText(/We matched \d+ fields? to your/)
		await page.getByRole('link', { name: 'Next: vendors' }).click()
		await page.waitForURL('**/vendors')

		await page.getByRole('button', { name: 'Add vendor' }).click()
		await page.locator('input[type=file]').setInputFiles(`${FIXTURES}/unknown-vendor.csv`)
		await expect(page.getByText(/1 ID isn’t in your records: Row 2: “R99”/)).toBeVisible()
		await expect(page.getByRole('checkbox', { name: /^Yes, this file has all of/ })).toBeDisabled()
		await expect(page.getByRole('link', { name: 'Next: what Jev checks' })).toHaveCount(0)

		// A vendor can be renamed at any point.
		const name = page.getByLabel('What’s this vendor called?')
		await name.fill('Acme Match')
		await name.press('Enter')
		await expect(page.getByRole('navigation', { name: 'Vendors' })).toContainText('Acme Match')
	})

	test('a plan over the limit is blocked, and says where its pairs come from', async ({ page }) => {
		await signUp(page)
		await createEvaluation(page, 'Over the cap')
		// 460 people sharing a name and postcode, and two vendors that each
		// merged 447 of them into one group: 99,681 pairs each, within a
		// vendor's limit, but 105,401 between them, more than one run can check.
		await uploadRecords(page, 'over-cap-source.csv')
		await expect(
			page
				.getByRole('list', { name: 'Steps' })
				.getByRole('link', { name: /^Records, completed\. 460 records/ })
		).toBeVisible()
		await addVendor(page, 'over-cap-vendor-a-groups.csv')
		await addVendor(page, 'over-cap-vendor-b-groups.csv')

		await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
		await page.waitForURL('**/rules')
		await reviewPlan(page)
		await expect(
			page.getByRole('heading', { name: /pairs is more than one run can check \(100K\)$/ })
		).toBeVisible()
		// Every vendor pair is checked, so the vendor's group is what to change.
		await expect(
			page.getByRole('listitem').filter({ hasText: 'Pairs your vendors matched' })
		).toBeVisible()
		await expect(page.getByRole('link', { name: 'Change the vendor files' })).toBeVisible()
		await expect(page.getByRole('button', { name: 'Start run' })).toBeDisabled()
	})

	test('PairSight suggests the pairs for people, says why, and never names how', async ({
		page
	}) => {
		test.slow()
		await signUp(page)
		await createEvaluation(page, 'Suggested pairs')
		// 2,000 fictional people with planted duplicates, some with first and
		// last names swapped or a typo.
		await uploadRecords(page, 'people-2000.csv')
		await addVendor(page, 'people-2000-vendor.csv')
		await expectVendorPairs(page, 1)
		await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
		await page.waitForURL('**/rules')

		// No rules and no switch: PairSight picks the pairs.
		const suggestions = page.getByRole('region', { name: 'The pairs Jev will check' })
		await expect(page.getByRole('switch')).toHaveCount(0)
		// The card fills in by itself once PairSight has looked at the records.
		await expect(suggestions).toContainText(/pairs suggested/, { timeout: 60_000 })
		await expect(suggestions).toContainText('Most suggested pairs share')
		await expect(suggestions).toContainText(
			/These already include 1 of the 1 pairs Vendor A matched/
		)
		await expect(page.locator('body')).not.toContainText(/splink/i)

		await reviewPlan(page)
		const ledger = page.getByRole('region', { name: 'From records to pairs' })
		await expect(ledger).toContainText(/Pairs PairSight suggested\s*\d+/)
		await expect(page.locator('body')).not.toContainText(/splink/i)

		await startRun(page)
		await expect(
			page.getByText(/PairSight suggested pairs that share something it compares/)
		).toBeVisible()
		await expect(page.locator('body')).not.toContainText(/splink/i)
	})

	// 2,000 fictional organisations and products with planted duplicates
	// (scripts/scale/companies.mts, products.mts; seed 42).
	for (const { type, file, kind, thing, shared } of [
		{
			type: 'organisations',
			file: 'companies-2000',
			kind: /^Organisations/,
			thing: 'organisation',
			shared: 'a company number'
		},
		{
			type: 'products',
			file: 'products-2000',
			kind: /^Products/,
			thing: 'product',
			shared: 'a barcode'
		}
	]) {
		test(`PairSight suggests the pairs for ${type} too`, async ({ page }) => {
			test.slow()
			await signUp(page)
			await createEvaluation(page, `Suggested ${type}`)
			await uploadFile(page, `${file}.csv`)
			await expect(page.getByRole('radio', { name: kind })).toBeChecked()
			await page.getByRole('button', { name: 'Next: vendors' }).click()
			await page.waitForURL('**/vendors')
			await addVendor(page, `${file}-vendor.csv`)
			await expectVendorPairs(page, 1)
			await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
			await page.waitForURL('**/rules')

			const suggestions = page.getByRole('region', { name: 'The pairs Jev will check' })
			await expect(suggestions).toContainText(`most likely to be the same ${thing}`)
			await expect(suggestions).toContainText(/pairs suggested/, { timeout: 60_000 })
			await expect(suggestions).toContainText('Most suggested pairs share')
			await expect(suggestions).toContainText(
				/These already include 1 of the 1 pairs Vendor A matched/
			)

			await reviewPlan(page)
			await expect(page.getByRole('region', { name: 'From records to pairs' })).toContainText(
				/Pairs PairSight suggested\s*\d+/
			)
			await startRun(page)
			await expect(
				page.getByText(`PairSight suggested pairs that share something it compares: ${shared}`)
			).toBeVisible()
			await expect(page.locator('body')).not.toContainText(/splink/i)
		})
	}

	test('a run over the old 5,000 limit plans, starts and finishes', async ({ page }) => {
		test.slow()
		await signUp(page)
		await createEvaluation(page, 'Big run')
		// 110 people sharing a name and postcode, 109 merged into one group by
		// the vendor: 5,886 pairs. PairSight suggests none of them (a name and
		// postcode alone aren't the same person), but every vendor pair is checked.
		await uploadRecords(page, 'big-run-source.csv')
		await addVendor(page, 'big-run-vendor-groups.csv')
		await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
		await page.waitForURL('**/rules')
		await reviewPlan(page)
		await expect(page.getByRole('region', { name: 'From records to pairs' })).toContainText(
			/Pairs Jev will check\s*5\.89K/
		)
		await expect(page.getByText(/· (under a minute|about \d)/)).toBeVisible()
		await expect(page.getByText(/more than one run can check/)).toHaveCount(0)
		await expect(page.getByRole('button', { name: 'Start run' })).toBeEnabled()
		await page.getByRole('button', { name: 'Start run' }).click()
		const card = page
			.getByRole('dialog', { name: 'Runs' })
			.getByRole('article', { name: 'Run 1 · Big run' })
		await expect(card).toContainText(/^Run 1 · Big runComplete · Started/, { timeout: 120_000 })
		await expect(card).toContainText('5.89K pairs')
	})

	test('PairSight suggests a duplicate that only looks alike, and the pair says why', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Hard cases')
		await uploadRecords(page, 'hard-source.csv')
		await addVendor(page, 'hard-vendor.csv')
		await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
		await page.waitForURL('**/rules')
		await reviewPlan(page)
		await startRun(page)
		// Smith and Smyth, born the same day, living apart, with other emails:
		// PairSight suggested them, Jev agrees, and the vendor missed it.
		await expect(tile(page, 'Only Jev says same')).toContainText('1')
		await tile(page, 'Only Jev says same').click()
		await page.waitForURL(/tab=detailed/)
		await expect(page.getByRole('table').getByText('Catherine Smyth')).toBeVisible()
		// The first pair shows beside the list; its own page says why it was checked.
		await page
			.getByRole('complementary', { name: 'The selected pair' })
			.getByRole('link', { name: /^See all \d+ fields on its own page/ })
			.click()
		await page.waitForURL('**/pairs/**')
		await expect(
			page.getByText(
				'Suggested by PairSight: the two records share a name spelled a little differently, the same date of birth.'
			)
		).toBeVisible()
	})

	test('changing the country saves itself', async ({ page }) => {
		await signUp(page)
		await createEvaluation(page, 'Country change')
		await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
		await page.waitForURL('**/rules')

		await page.getByRole('combobox', { name: 'Where are these records from?' }).click()
		await page.getByRole('option', { name: 'United Kingdom' }).click()
		await expect(page.getByText('Saved', { exact: true })).toBeVisible()
		await page.reload()
		await expect(page.getByRole('combobox', { name: 'Where are these records from?' })).toHaveText(
			'United Kingdom'
		)
	})

	test('changes save themselves; invalid ones are held back and say why', async ({ page }) => {
		await signUp(page)
		await createEvaluation(page, 'Autosave')
		await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
		await page.waitForURL('**/rules')
		const stepLink = (name: string) =>
			page.getByRole('list', { name: 'Steps' }).getByRole('link', { name: new RegExp(`^${name},`) })

		// A cut-off saves itself and is still set after leaving and coming back.
		await page.getByRole('radio', { name: /^Strict/ }).click()
		await expect(page.getByText('Saved', { exact: true })).toBeVisible()
		await stepLink('Vendors').click()
		await page.waitForURL('**/vendors')
		await stepLink('What Jev checks').click()
		await page.waitForURL('**/rules')
		await expect(page.getByRole('radio', { name: /^Strict/ })).toBeChecked()

		// An empty definition is never saved: the reason shows, the plan waits.
		const same = page.getByLabel('When are two records the same?', { exact: true })
		const definition = await same.inputValue()
		await same.fill('')
		await expect(page.getByText('Tell Jev when two records are the same').first()).toBeVisible()
		await expect(page.getByRole('link', { name: 'Check and start', exact: true })).toHaveCount(0)
		await page.reload()
		await expect(same).toHaveValue(definition)

		// One field isn't enough for Jev to tell people apart.
		const jevFields = page.getByRole('group', { name: 'What should Jev get to see?' })
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
		await expect(
			page.getByText('Pick at least two, so Jev has something to compare.')
		).toBeVisible()
		await jevFields.getByLabel('Email').check()
		await reviewPlan(page)
	})

	test('a save can be undone, and the suggested wording is a click away', async ({ page }) => {
		await signUp(page)
		await createEvaluation(page, 'Undo')
		await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
		await page.waitForURL('**/rules')
		const same = page.getByLabel('When are two records the same?', { exact: true })
		const suggested = await same.inputValue()
		const useSuggested = page.getByRole('button', { name: 'Use the suggested wording' })
		await expect(useSuggested).toHaveCount(0)

		// Saved, with Undo long enough to reach (past the usual toast's 5 s).
		await same.fill('Two records are the same person when their emails match.')
		const saved = page.getByText('Change saved', { exact: true })
		await expect(saved).toBeVisible()
		await page.waitForTimeout(6000)
		await expect(saved).toBeVisible()
		await page.getByRole('button', { name: 'Undo' }).click()
		await expect(same).toHaveValue(suggested)
		await expect(page.getByText('Put back as it was', { exact: true })).toBeVisible()
		await page.reload()
		await expect(same).toHaveValue(suggested)

		// Your own wording can go back to the record type's in one click.
		await same.fill('Two records are the same person when their phones match.')
		await expect(saved).toBeVisible()
		await useSuggested.click()
		await expect(same).toHaveValue(suggested)
		await expect(useSuggested).toHaveCount(0)
		await expect(page.getByText('Saved', { exact: true })).toBeVisible()
		await page.reload()
		await expect(same).toHaveValue(suggested)
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
		await expect(vendorList).toContainText('Needs: upload a file that passes the checks')
		await page.reload()
		await expect(vendorList).toContainText('Needs: upload a file that passes the checks')
		await expect(
			page.getByText('Finish Vendor B: upload a file that passes the checks')
		).toBeVisible()

		// A group export: one record per row, read without choosing any columns.
		await page.locator('input[type=file]').setInputFiles(`${FIXTURES}/demo-vendor-b-groups.csv`)
		await expect(
			page.getByText('Read as one record per row, grouped by match_id · record IDs in record')
		).toBeVisible()
		await expectVendorPairs(page, 3)
		await page.getByRole('checkbox', { name: /^Yes, this file has all of/ }).click()
		await expect(vendorList).toContainText('List of groups · ready')
		await runEvaluation(page)

		// Both side by side, one card each; a card picks the vendor the page describes.
		const comparison = page.getByRole('region', { name: 'How do the vendors compare?' })
		await expect(comparison.getByRole('heading', { level: 3 })).toHaveText(['Vendor A', 'Vendor B'])
		await expect(comparison.getByRole('link', { name: 'Vendor A' })).toHaveAttribute(
			'aria-current',
			'true'
		)
		// Beside the list, the selected pair says what every vendor decided.
		await page.getByRole('link', { name: /^Detailed analysis/ }).click()
		await expect(
			page
				.getByRole('complementary', { name: 'The selected pair' })
				.getByRole('region', { name: 'Who says what' })
		).toContainText(/Vendor A.*Vendor B.*Jev/)
	})

	test('three vendors are compared side by side, and that’s the limit', async ({ page }) => {
		await signUp(page)
		await createEvaluation(page, 'Three vendors')
		await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await addVendor(page, 'demo-vendor-b.csv')
		await addVendor(page, 'demo-vendor-c.csv')
		await expect(page.getByRole('navigation', { name: 'Vendors' })).toContainText(
			/Vendor C\s*List of pairs · ready/
		)
		// A fourth can't be added: the button gives way to the limit.
		await expect(page.getByRole('button', { name: 'Add vendor' })).toHaveCount(0)
		await expect(page.getByText('You can compare up to 3 vendors.')).toBeVisible()
		await runEvaluation(page)

		// Best overall first, as the headline ranks them; the leader has the pill.
		const comparison = page.getByRole('region', { name: 'How do the vendors compare?' })
		await expect(comparison.getByRole('heading', { level: 3 })).toHaveText([
			'Vendor C',
			'Vendor A',
			'Vendor B'
		])
		await expect(comparison.getByRole('article').first()).toContainText('Best overall')

		// Each vendor's own results: Vendor C's matches, judged against Jev.
		await comparison.getByRole('link', { name: 'Vendor C' }).click()
		await expect(page).toHaveURL(/vendor=/)
		await expect(comparison.getByRole('link', { name: 'Vendor C' })).toHaveAttribute(
			'aria-current',
			'true'
		)
		await expect(tile(page, 'Both say same')).toBeVisible()
		// Beside the list, the selected pair says what every vendor decided.
		await page.getByRole('link', { name: /^Detailed analysis/ }).click()
		await expect(
			page
				.getByRole('complementary', { name: 'The selected pair' })
				.getByRole('region', { name: 'Who says what' })
		).toContainText(/Vendor A.*Vendor B.*Vendor C.*Jev/)
	})

	test('locked steps can’t be opened by URL: they land where the evaluation is up to', async ({
		page
	}) => {
		await signUp(page)
		await expect(
			page.getByRole('heading', { name: 'Ready to check your first vendor?' })
		).toBeVisible()

		await createEvaluation(page, 'Locked steps')
		const records = page.url()
		for (const step of ['vendors', 'rules', 'plan', 'run', 'results']) {
			// (`run` is the old Run step's address; it lands in the same place.)
			await page.goto(records.replace(/\/records$/, `/${step}`))
			await page.waitForURL(records)
			await expect(
				page.getByText('Drop your file here, or choose one (CSV or Excel)')
			).toBeVisible()
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
		await expect(page.getByText('We can’t find that page')).toBeVisible()
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
			await expect(page.getByText('We can’t find that page')).toBeVisible()
		}
	})

	test('the sidebar shows the pipeline, collapses, and remembers its width', async ({ page }) => {
		await signUp(page)
		await createEvaluation(page, 'Shell')
		const pipeline = page.getByRole('list', { name: 'Steps' })
		await expect(
			pipeline.getByRole('link', { name: /^Records, next step\. No file yet/ })
		).toBeVisible()
		await expect(page.getByRole('banner').getByText('Draft', { exact: true })).toBeVisible()

		await uploadRecords(page, 'demo-source.csv')
		await expect(
			pipeline.getByRole('link', { name: /^Records, completed\. 220 records/ })
		).toBeVisible()
		await expect(
			pipeline.getByRole('link', { name: /^Vendors, next step\. None added/ })
		).toBeVisible()
		// Locked stages say what they're waiting for.
		await expect(
			pipeline.getByRole('link', {
				name: /^Results, locked\. Start a run from Check and start first/
			})
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
		await expect(other.getByText('We can’t find that page')).toBeVisible()
	})
	test('a key refused for a few seconds is a blip: the run carries on and completes', async ({
		page
	}) => {
		const marker = await readyToStart(page, 'Key blip')
		await page.request.post(`${JEV_STUB}/reject?marker=${marker}&status=403`)
		await page.getByRole('button', { name: 'Start run' }).click()
		const card = page
			.getByRole('dialog', { name: 'Runs' })
			.getByRole('article', { name: 'Run 1 · Key blip' })
		await expect.poll(() => jevCalls(page, marker), { timeout: 15_000 }).toBeGreaterThan(0)
		await page.request.post(`${JEV_STUB}/accept?marker=${marker}`)
		await expect(card).toContainText(/^Run 1 · Key blipComplete · Started/, { timeout: 45_000 })
		await expect(card.getByRole('alert')).toHaveCount(0)
		await expect(card).toContainText('8 pairs')
		await expect(card).not.toContainText('couldn’t')
	})

	// Jev pushing back slows every call this server makes (one shared limit,
	// worker/jev-limiter.ts), so these run one at a time, after everything else
	// (playwright.config.ts, the `pushback` project).
	test.describe('when Jev pushes back @pushback', () => {
		test.describe.configure({ mode: 'serial' })

		// Starts the run with Jev having a bad day (one of the stub's switches),
		// and expects it to finish complete anyway: every pair checked, none failed.
		async function expectFinishesComplete(page: Page, name: string, trouble: string) {
			const marker = await readyToStart(page, name)
			await expect(page.getByText(/· (under a minute|about \d)/)).toBeVisible()
			await page.request.post(
				`${JEV_STUB}/${trouble}${trouble.includes('?') ? '&' : '?'}marker=${marker}`
			)
			await page.getByRole('button', { name: 'Start run' }).click()
			const card = page
				.getByRole('dialog', { name: 'Runs' })
				.getByRole('article', { name: `Run 1 · ${name}` })
			return {
				card,
				marker,
				finished: async () => {
					await expect(card).toContainText(new RegExp(`^Run 1 · ${name}Complete · Started`), {
						timeout: 120_000
					})
					await expect(card).toContainText('8 pairs')
					await expect(card).not.toContainText('couldn’t')
					await page.request.post(`${JEV_STUB}/calm?marker=${marker}`)
				}
			}
		}

		test('one call that never answers holds up only itself, not the rest of the run', async ({
			page
		}) => {
			test.slow()
			await signUp(page)
			await createEvaluation(page, 'Stuck call')
			// 30 people sharing one phone number (an office line): 435 pairs,
			// more than one round of calls.
			const marker = await uploadRecords(page, 'crowd-source.csv')
			await addVendor(page, 'crowd-vendor.csv')
			await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
			await page.waitForURL('**/rules')
			await reviewPlan(page)
			// The first call never answers (it times out after 10 s here).
			await page.request.post(`${JEV_STUB}/hang?marker=${marker}&count=1`)
			await page.getByRole('button', { name: 'Start run' }).click()
			const card = page
				.getByRole('dialog', { name: 'Runs' })
				.getByRole('article', { name: 'Run 1 · Stuck call' })
			// Every other pair is checked well before that call gives up.
			const progress = card.getByRole('progressbar')
			await expect(progress).toHaveAttribute('aria-valuemax', '435')
			await expect
				.poll(
					async () =>
						Number(await progress.getAttribute('aria-valuemax')) -
						Number(await progress.getAttribute('aria-valuenow')),
					{ timeout: 6_000, intervals: [250] }
				)
				.toBe(1)
			await expect(card).toContainText(/^Run 1 · Stuck callComplete · Started/, {
				timeout: 60_000
			})
			await expect(card).not.toContainText('couldn’t')
		})

		test('rate limited at first: it waits as asked and finishes with nothing failed', async ({
			page
		}) => {
			test.slow()
			const run = await expectFinishesComplete(
				page,
				'Rate limited',
				'busy?status=429&retryAfter=2&count=6'
			)
			await run.finished()
		})

		test('an outage: the run says it’s waiting, then carries on by itself', async ({ page }) => {
			test.slow()
			const run = await expectFinishesComplete(page, 'Outage', 'outage?seconds=12')
			await expect(run.card).toContainText('Jev is busy right now, so we’re waiting', {
				timeout: 30_000
			})
			await expect(run.card).toContainText('Waiting for Jev')
			await run.finished()
			await expect(run.card).not.toContainText('so we’re waiting')
		})

		test('calls that never answer time out and are tried again', async ({ page }) => {
			test.slow()
			const run = await expectFinishesComplete(page, 'No answer', 'hang?count=2')
			await run.finished()
		})

		test('an answer that isn’t Jev’s is tried again', async ({ page }) => {
			test.slow()
			const run = await expectFinishesComplete(page, 'Garbled', 'garbage?count=3')
			await run.finished()
		})
	})
})
