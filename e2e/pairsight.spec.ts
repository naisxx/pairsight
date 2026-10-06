import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { readPdfText } from './pdf'
import {
	exportFindings,
	fixtureWorkbook,
	readWorkbook,
	workbookFromCsv,
	XLSX_MIME
} from './workbooks'

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
	// (see uploadRecords).
	function markedRecords(file: string) {
		const marker = `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
		const csv = readFileSync(`${FIXTURES}/${file}`, 'utf8').replace(
			/@example\.com/gi,
			`@${marker}.example.com`
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
		await expect(page.getByText('What’s in each column?')).toBeVisible()
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
		await expect(complete).toBeEnabled()
		await complete.click()
		await expect(complete).toBeChecked()
		await expect(complete).toBeDisabled()
	}

	// The selected vendor's matched-pair count.
	async function expectVendorPairs(page: Page, count: number) {
		await expect(page.getByLabel('What’s in the file')).toContainText(
			new RegExp(`Matched pairs\\s*${count}(?!\\d)`)
		)
	}

	// Rules save themselves; the plan opens once they have.
	async function reviewPlan(page: Page) {
		await expect(page.getByText('Saved', { exact: true })).toBeVisible()
		await page.getByRole('link', { name: 'Check and start', exact: true }).click()
		await page.waitForURL('**/plan')
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
		await page.getByRole('link', { name: 'Next: rules' }).click()
		await page.waitForURL('**/rules')
		await reviewPlan(page)
		await startRun(page)
	}

	// The Overview's category tiles; each opens its pairs in the detailed view.
	function tile(page: Page, name: string) {
		return page
			.getByRole('region', { name: 'Pairs by who says what' })
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
		await page.getByRole('link', { name: 'Next: rules' }).click()
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
			buffer: readFileSync(`${FIXTURES}/${file}`)
		})
		await expect(page.getByText('What’s in each column?')).toBeVisible()
	}

	test('organisations: detected from the columns, blocked by website and registration, judged as organisations', async ({
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

		await page.getByRole('link', { name: 'Next: rules' }).click()
		await page.waitForURL('**/rules')
		// An organisation's own presets, on by default; no person rules.
		await expect(page.getByRole('switch', { name: 'Same website rule' })).toBeChecked()
		await expect(page.getByRole('switch', { name: 'Same registration number rule' })).toBeChecked()
		await expect(page.getByRole('switch', { name: 'Same email rule' })).not.toBeChecked()
		await expect(
			page.getByRole('switch', { name: 'Same last name and postcode rule' })
		).toHaveCount(0)
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

	test('products: detected from the columns, blocked by barcode and part number, variants kept apart', async ({
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

		await page.getByRole('link', { name: 'Next: rules' }).click()
		await page.waitForURL('**/rules')
		await expect(page.getByRole('switch', { name: 'Same barcode (GTIN) rule' })).toBeChecked()
		await expect(
			page.getByRole('switch', { name: 'Same part number and brand rule' })
		).toBeChecked()
		await reviewPlan(page)
		await startRun(page)

		// One duplicate both found; two the vendor missed (one item under a UPC
		// and an EAN); a size and a brand it wrongly merged; a colour variant
		// both kept apart.
		await expect(tile(page, 'Both say same')).toContainText('1')
		await expect(tile(page, 'Only Jev says same')).toContainText('2')
		await expect(tile(page, 'Only vendor says same')).toContainText('2')
		await expect(tile(page, 'Both say different')).toContainText('1')
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
		await expect(page.getByText('What’s in each column?')).toBeVisible({ timeout: 30_000 })
		// The row count is shortened, exact on hover.
		const rows = page.getByLabel('File details').getByText('10K', { exact: true })
		await expect(rows).toHaveAttribute('title', '10,000')
		await page.getByRole('button', { name: 'Next: vendors' }).click()
		await page.waitForURL('**/vendors', { timeout: 60_000 })
		expect(uploads).toHaveLength(1)
		await expect(page.getByRole('navigation').getByText('10K records')).toBeVisible()
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
		await expect(page.getByText('What’s in each column?')).toBeVisible()
		await expect(page.getByText('Not saved yet · Excel · Sheet Customers')).toBeVisible()
		expect(uploads).toHaveLength(1)
		// Dates and numbers read as written: 1990-04-12, not a serial number.
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

	test('upload to comparison: all four categories, vendor pairs outside blocking, inspection', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Demo scenario')
		await uploadRecords(page, 'demo-source.csv')
		await expect(
			page
				.getByRole('list', { name: 'Steps' })
				.getByRole('link', { name: /^Records, completed\. 24 records/ })
		).toBeVisible()
		await addVendor(page, 'demo-vendor-a.csv')
		await expectVendorPairs(page, 4)

		await page.getByRole('link', { name: 'Next: rules' }).click()
		await reviewPlan(page)
		const plan = page.getByRole('region', { name: 'From records to pairs' })
		await expect(plan).toContainText(/Pairs Jev will check\s*8/)
		// All 4 vendor pairs are assessed; 2 of them the rules already found.
		await expect(plan).toContainText(/Pairs your vendors matched\s*\+4/)
		await expect(plan).toContainText('2 vendor pairs your rules already picked')
		await startRun(page)

		for (const name of [
			'Only Jev says same',
			'Only vendor says same',
			'Both say same',
			'Both say different'
		]) {
			await expect(tile(page, name)).toContainText('2')
		}
		await expect(tile(page, 'Not checked yet')).toContainText('0')
		// Coverage: 6 pairs from the rules, 2 added only because the vendor matched them.
		const coverage = page.getByRole('region', { name: 'What did Jev check?' })
		await expect(coverage).toContainText(/Picked by your rules\s*6/)
		await expect(coverage).toContainText(/Added because a vendor matched it\s*2/)

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
		expect(report).toContain('On these 24 records, Vendor A agreed with Jev')
		expect(report).toContain('2 wrong merges')
		expect(report).toContain('Agreement with Jev, an AI · checked pairs only')
		expect(report).toContain('Human review None. Every answer here is Jev’s.')

		await tile(page, 'Only vendor says same').click()
		await page.waitForURL(/tab=detailed/)
		await expect(matching(page)).toHaveText('2 pairs')

		// From the keyboard: / jumps to search; ↓ then Enter opens the first pair.
		await page.keyboard.press('/')
		await expect(page.getByRole('searchbox', { name: 'Search by name or record ID' })).toBeFocused()
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
		await page.getByRole('button', { name: /^Match cut-off 0\.50/ }).click()
		const thresholdValue = page.getByLabel('Cut-off', { exact: true })
		await thresholdValue.fill('0.40')
		await thresholdValue.press('Enter')
		const popover = page.getByRole('dialog')
		await expect(popover).toContainText(/Only Jev says same\s*2\s*becomes\s*3/)
		await expect(popover.getByRole('button', { name: 'Apply' })).toHaveCount(0)
		await popover.getByRole('button', { name: 'Reset to 0.50' }).click()
		await expect(thresholdValue).toHaveValue('0.50')
		await popover.getByRole('link', { name: 'Change in Rules' }).click()
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
		await page.getByRole('combobox', { name: 'Checked?' }).click()
		await page.getByRole('option', { name: 'Checked', exact: true }).click()
		await expect(page).toHaveURL(/status=evaluated/)
		await expect(matching(page)).toHaveText('1 pair')
		await page.getByRole('button', { name: 'Clear filters' }).click()
		await expect(page).not.toHaveURL(/status=/)
		await page.getByRole('link', { name: /^Overview/ }).click()
		await page.waitForURL(/\/results\?vendor=[^&]+$/)

		// Retrying one pair from its page: Jev judges it this time.
		await tile(page, 'Not checked yet').click()
		await page.waitForURL(/category=incomplete/)
		await expect(
			page.getByText('Couldn’t check · Jev couldn’t read this pair').first()
		).toBeVisible()
		await page.locator('tbody tr').filter({ hasText: 'Retrycase' }).locator('a').click()
		await page.waitForURL('**/pairs/**')
		await page.getByRole('button', { name: 'Check this pair again' }).click()
		await expect(page.getByRole('region', { name: 'Who says what' })).toContainText(/Jev\s*Same/, {
			timeout: 30_000
		})
		await page.getByRole('link', { name: 'Back to results' }).click()
		await page.waitForURL(/\/results\?/)

		// A failed row can be retried from the table too; Failcase fails again.
		const rowCalls = await jevCalls(page, marker)
		await page.getByRole('button', { name: /^Check pair F\d and F\d again$/ }).click()
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
		await page.getByRole('dialog').getByRole('link', { name: 'Change in Rules' }).click()
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
		await signUp(page)
		await createEvaluation(page, 'Key problem')
		const marker = await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await expectVendorPairs(page, 4)
		await page.request.post(`${JEV_STUB}/reject?marker=${marker}`)

		await page.getByRole('link', { name: 'Next: rules' }).click()
		await page.waitForURL('**/rules')
		await reviewPlan(page)
		await page.getByRole('button', { name: 'Start run' }).click()
		// A stopped run is in Completed, marked as failed, with the reason and the fix.
		const runs = page.getByRole('dialog', { name: 'Runs' })
		const card = runs.getByRole('article', { name: 'Run 1 · Key problem' })
		await expect(card.getByRole('alert')).toContainText('its access key was refused', {
			timeout: 30_000
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
		await page.getByRole('link', { name: 'Next: rules' }).click()
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
		await expect(page.getByRole('heading', { name: 'What each column holds' })).toBeVisible()
		await expect(page.getByLabel('File details')).toContainText('demo-source.csv')
		await page.getByRole('button', { name: 'Replace file' }).click()
		const replace = page.getByRole('dialog', { name: 'Use a different file?' })
		await replace.getByRole('button', { name: 'No, keep this one' }).click()
		await expect(page.getByRole('heading', { name: 'What each column holds' })).toBeVisible()
		await page.getByRole('link', { name: 'Next: vendors' }).click()
		await page.waitForURL('**/vendors')

		await page.getByRole('button', { name: 'Add vendor' }).click()
		await page.locator('input[type=file]').setInputFiles(`${FIXTURES}/unknown-vendor.csv`)
		await expect(page.getByText(/1 ID isn’t in your records: Row 2: “R99”/)).toBeVisible()
		await expect(page.getByRole('checkbox', { name: /^Yes, this file has all of/ })).toBeDisabled()
		await expect(page.getByRole('link', { name: 'Next: rules' })).toHaveCount(0)

		// A vendor can be renamed at any point.
		const name = page.getByLabel('What’s this vendor called?')
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
				.getByRole('list', { name: 'Steps' })
				.getByRole('link', { name: /^Records, completed\. 105 records/ })
		).toBeVisible()
		await addVendor(page, 'over-cap-vendor.csv')
		await expectVendorPairs(page, 1)

		await page.getByRole('link', { name: 'Next: rules' }).click()
		await page.waitForURL('**/rules')
		await expect(page.getByText('This rule alone picks 5.46K pairs').first()).toBeVisible()
		// The live summary and the action bar say it before the plan does.
		await expect(
			page.getByText(
				'460 pairs over the limit. Turn off a rule, or add a value to one, so it picks fewer.'
			)
		).toBeVisible()
		await expect(page.getByText('Bring the pairs down to 5K or fewer (now 5.46K)')).toBeVisible()
		await expect(page.getByRole('link', { name: 'Check and start', exact: true })).toHaveCount(0)
		await page.goto(page.url().replace(/\/rules$/, '/plan'))
		const overLimit = page.getByRole('heading', {
			name: '5.46K pairs is more than one run can check (5K)'
		})
		await expect(overLimit).toBeVisible()
		await expect(
			page.getByRole('listitem').filter({ hasText: 'Same name and postcode' })
		).toContainText('5.46K pairs · biggest group 105')
		await expect(page.getByRole('button', { name: 'Start run' })).toBeDisabled()

		// Turning the rule off from the plan brings it under the limit.
		await page.getByRole('button', { name: 'Turn off Same name and postcode' }).click()
		await expect(overLimit).toHaveCount(0)
		await page.getByRole('link', { name: 'Rules', exact: true }).click()
		await page.waitForURL('**/rules')
		await expect(
			page.getByRole('switch', { name: 'Same name and postcode rule' })
		).not.toBeChecked()
		await page.getByRole('button', { name: 'Add your own rule' }).click()
		const fields = page.getByRole('group', { name: 'Values in this rule' })
		await fields.getByRole('button', { name: 'Email' }).click()
		await expect(page.getByText('You already have a rule with these values.')).toBeVisible()
		await fields.getByRole('button', { name: 'Postcode' }).click()
		await expect(page.getByRole('button', { name: 'Save rule' })).toBeEnabled()
		await page.getByRole('button', { name: 'Save rule' }).click()
		await expect(page.getByRole('button', { name: 'Edit Email AND Postcode' })).toBeVisible()

		await reviewPlan(page)
		await expect(page.getByRole('region', { name: 'From records to pairs' })).toContainText(
			/Pairs Jev will check\s*1/
		)
		await expect(page.getByRole('button', { name: 'Start run' })).toBeEnabled()

		// The composite rule was saved with the rest of the configuration.
		await page.goto(page.url().replace(/\/plan$/, '/rules'))
		await expect(page.getByRole('button', { name: 'Edit Email AND Postcode' })).toBeVisible()
	})

	test('a fuzzy rule finds the duplicate exact rules miss, and Results calls it a hard case', async ({
		page
	}) => {
		await signUp(page)
		await createEvaluation(page, 'Hard cases')
		await uploadRecords(page, 'hard-source.csv')
		await addVendor(page, 'hard-vendor.csv')
		await page.getByRole('link', { name: 'Next: rules' }).click()
		await page.waitForURL('**/rules')
		// The fuzzy presets are offered, off by default.
		await expect(
			page.getByRole('switch', { name: 'Similar-sounding surname and birth year rule' })
		).not.toBeChecked()

		// A custom rule on derived keys: a birth year alone is too broad.
		await page.getByRole('button', { name: 'Add your own rule' }).click()
		const fields = page.getByRole('group', { name: 'Values in this rule' })
		const matchOn = async (field: string, transform: string) => {
			await page.getByRole('combobox', { name: `Match ${field} on` }).click()
			await page.getByRole('option', { name: transform, exact: true }).click()
		}
		await fields.getByRole('button', { name: 'Date of birth' }).click()
		await matchOn('Date of birth', 'year')
		await expect(page.getByText('Date of birth (year) is too broad on its own.')).toBeVisible()
		await expect(page.getByRole('button', { name: 'Save rule' })).toBeDisabled()
		await fields.getByRole('button', { name: 'First name' }).click()
		await matchOn('First name', 'sounds like')
		await expect(page.getByText(/groups · /)).toContainText('1 groups · 1 pairs')
		await page.getByRole('button', { name: 'Save rule' }).click()
		const rule = 'First name (sounds like) AND Date of birth (year)'
		await expect(page.getByRole('button', { name: `Edit ${rule}` })).toBeVisible()
		// The surname preset, built by hand, is a rule that already exists.
		await page.getByRole('button', { name: 'Add your own rule' }).click()
		await fields.getByRole('button', { name: 'Last name' }).click()
		await matchOn('Last name', 'sounds like')
		await fields.getByRole('button', { name: 'Date of birth' }).click()
		await matchOn('Date of birth', 'year')
		await expect(page.getByText('You already have a rule with these values.')).toBeVisible()
		await page.getByRole('button', { name: 'Cancel' }).click()

		await reviewPlan(page)
		await startRun(page)
		// Smith and Smyth, born the same day: only the fuzzy rule found them,
		// Jev agrees, and the vendor missed it.
		await expect(tile(page, 'Only Jev says same')).toContainText('1')
		const sources = page.getByRole('region', { name: 'Why was each pair checked?' })
		await expect(sources).toContainText(rule)
		// The hard cases sit behind the card's (i), seen without scrolling.
		await sources
			.getByRole('button', { name: 'About these numbers and hard-to-spot duplicates' })
			.hover()
		const tip = page.getByRole('tooltip')
		await expect(tip).toContainText('1 duplicate was picked only by close-match rules')
		await expect(tip).toContainText('Vendor A caught 0')

		const summary = await exportFindings(page, 1, /^Summary report/)
		const report = await readPdfText(await summary.path())
		expect(report).toContain('Hard cases')
		expect(report).toContain('Vendor A caught 0 of the 1 hard-to-spot duplicate.')

		await sources
			.getByRole('link', { name: 'See the 1 pair only close-match rules picked' })
			.click()
		await page.waitForURL(/source=fuzzy/)
		await expect(matching(page)).toHaveText('1 pair')
		await expect(page.getByRole('table').getByText('Catherine Smyth')).toBeVisible()
	})

	test('changing the country saves itself and recounts the phone rule', async ({ page }) => {
		await signUp(page)
		await createEvaluation(page, 'Country change')
		await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await page.getByRole('link', { name: 'Next: rules' }).click()
		await page.waitForURL('**/rules')
		const phoneRule = page.locator('li').filter({ hasText: 'Same phone' })
		const before = await phoneRule.innerText()

		await page.getByRole('combobox', { name: 'Where are these records from?' }).click()
		await page.getByRole('option', { name: 'United Kingdom' }).click()
		await expect(page.getByText('Saved', { exact: true })).toBeVisible()
		// US numbers don't parse as British ones, so the phone rule's counts change.
		await expect(phoneRule).not.toHaveText(before)
		await page.reload()
		await expect(page.getByRole('combobox', { name: 'Where are these records from?' })).toHaveText(
			'United Kingdom'
		)
	})

	test('rule changes save themselves; invalid ones are held back and say why', async ({ page }) => {
		await signUp(page)
		await createEvaluation(page, 'Autosave')
		await uploadRecords(page, 'demo-source.csv')
		await addVendor(page, 'demo-vendor-a.csv')
		await page.getByRole('link', { name: 'Next: rules' }).click()
		await page.waitForURL('**/rules')
		const stepLink = (name: string) =>
			page.getByRole('list', { name: 'Steps' }).getByRole('link', { name: new RegExp(`^${name},`) })

		// A switch saves itself and is still on after leaving and coming back.
		const nameRule = page.getByRole('switch', { name: 'Same name rule' })
		await nameRule.click()
		await expect(page.getByText('Saved', { exact: true })).toBeVisible()
		await stepLink('Vendors').click()
		await page.waitForURL('**/vendors')
		await stepLink('Rules').click()
		await page.waitForURL('**/rules')
		await expect(nameRule).toBeChecked()

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

		// One vendor at a time, switchable; and both side by side.
		await expect(page.getByRole('radio', { name: 'Vendor B' })).toBeVisible()
		const comparison = page.getByRole('region', { name: 'How do the vendors compare?' })
		await expect(comparison).toBeVisible()
		await comparison.getByRole('button', { name: 'Show as table' }).click()
		await expect(comparison.getByRole('rowheader')).toHaveText(['Vendor A', 'Vendor B'])
		await expect(page.getByRole('region', { name: 'Where do the vendors agree?' })).toBeVisible()
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

		await expect(page.getByRole('radio', { name: 'Vendor C' })).toBeVisible()
		const comparison = page.getByRole('region', { name: 'How do the vendors compare?' })
		await comparison.getByRole('button', { name: 'Show as table' }).click()
		await expect(comparison.getByRole('rowheader')).toHaveText(['Vendor A', 'Vendor B', 'Vendor C'])
		await expect(page.getByRole('region', { name: 'Where do the vendors agree?' })).toBeVisible()

		// Each vendor's own results: Vendor C's matches, judged against Jev.
		await page.getByRole('radio', { name: 'Vendor C' }).click()
		await expect(page).toHaveURL(/vendor=/)
		await expect(tile(page, 'Both say same')).toBeVisible()
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
			pipeline.getByRole('link', { name: /^Records, completed\. 24 records/ })
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
})
