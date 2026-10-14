import { expect, test, type Browser, type Page } from '@playwright/test'
import { failOnCspViolations } from './csp'

failOnCspViolations()

// PairSight on a customer's own machine (docs/PairSight-OnPrem.md), against a
// server with PAIRSIGHT_DEPLOYMENT=onprem and an EMPTY database: the first
// account becomes the admin, admins manage who else is one in Settings, the
// privacy page says what stays on the machine. Opt in with E2E_ONPREM=1;
// it must be the only spec run against that server, in order.
//
// Against the Compose stack (deploy/onprem, the onprem CI workflow), set
// E2E_JEV_ADDRESS to the Jev stub's address as the app server reaches it: the
// admin then saves a key there and runs the sample files end to end, through
// the image's own Splink and run worker, and the image is checked for having
// no landing page or demo.

const PASSWORD = 'e2e-password-123'
const SAMPLES = 'public/samples'
const JEV_ADDRESS = process.env.E2E_JEV_ADDRESS

test.describe.configure({ mode: 'serial' })

test.describe('On-prem', () => {
	test.skip(process.env.E2E_ONPREM !== '1', 'Needs an on-prem server on an empty database')

	// The first account, kept for the run below.
	let adminEmail = ''

	async function signUp(page: Page, name: string) {
		const email = `e2e+onprem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@pairsight.test`
		await page.goto('/sign-up')
		await page.getByLabel('Email').fill(email)
		await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
		await page.getByRole('button', { name: 'Create account' }).click()
		await page.waitForURL('**/welcome**')
		await page.getByLabel('Full name').fill(name)
		await page.getByRole('button', { name: 'Continue' }).click()
		await page.waitForURL('**/evaluations')
		return email
	}

	async function newPerson(browser: Browser, name: string) {
		const page = await (await browser.newContext()).newPage()
		const email = await signUp(page, name)
		await page.goto('/settings')
		return { page, email }
	}

	test('the first account is the admin, and admins decide who else is', async ({ browser }) => {
		const { page: first, email } = await newPerson(browser, 'First Admin')
		adminEmail = email
		const people = first.getByRole('region', { name: 'People' })
		await expect(people.getByRole('listitem').filter({ hasText: 'First Admin' })).toContainText(
			'(you)Admin'
		)
		// The admin sets the Jev key, even when the server has one of its own
		// (run this against a server with TYPESAFE_API_KEY set); there's no
		// button to remove yourself.
		await expect(first.getByText('No Jev key yet, so runs can’t start.')).toBeVisible()
		await expect(first.getByLabel('Jev key')).toBeVisible()
		await expect(people.getByRole('button')).toHaveCount(0)

		// Anyone after that is not an admin: Settings shows, but doesn't change.
		const { page: second } = await newPerson(browser, 'Second Person')
		await expect(second.getByText('Only an admin can change the Jev key.')).toBeVisible()
		await expect(second.getByLabel('Jev key')).toHaveCount(0)
		await expect(second.getByRole('region', { name: 'People' })).toHaveCount(0)

		await first.reload()
		await people.getByRole('button', { name: 'Make Second Person an admin' }).click()
		await expect(first.getByText('Second Person is now an admin.', { exact: true })).toBeVisible()
		await expect(people.getByRole('listitem').filter({ hasText: 'Second Person' })).toContainText(
			'Admin'
		)
		await second.reload()
		await expect(second.getByLabel('Jev key')).toBeVisible()

		await people.getByRole('button', { name: 'Remove Second Person as an admin' }).click()
		await expect(
			first.getByText('Second Person is no longer an admin.', { exact: true })
		).toBeVisible()
		await second.reload()
		await expect(second.getByText('Only an admin can change the Jev key.')).toBeVisible()
	})

	test('the privacy page says everything stays on this machine', async ({ page }) => {
		await page.goto('/privacy')
		await expect(
			page.getByRole('heading', { name: 'On your organisation’s own machine' })
		).toBeVisible()
		await expect(page.getByText('This copy doesn’t count how it’s used')).toBeVisible()
	})

	test('there’s no landing page or demo: those are the hosted site’s', async ({ page }) => {
		// A dev server still has their routes; the image's build doesn't.
		test.skip(JEV_ADDRESS == null, 'Needs the Compose stack: set E2E_JEV_ADDRESS')
		// "/" opens Evaluations, which sends anyone signed out to sign in, and
		// sign-in doesn't point at a demo that isn't there.
		await page.goto('/')
		await page.waitForURL('**/sign-in**')
		await expect(page.getByRole('link', { name: 'Look at the demo first' })).toHaveCount(0)
		expect((await page.goto('/sandbox'))?.status()).toBe(404)
	})

	test('the admin sets the Jev key and runs the sample files', async ({ page }) => {
		test.skip(JEV_ADDRESS == null, 'Needs the Jev stub beside the stack: set E2E_JEV_ADDRESS')
		test.setTimeout(240_000)
		await page.goto('/sign-in')
		await page.getByLabel('Email').fill(adminEmail)
		await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
		await page.getByRole('button', { name: 'Sign in', exact: true }).click()
		await page.waitForURL('**/evaluations')

		await page.goto('/settings')
		await page.getByLabel('Jev key').fill('e2e-onprem-key')
		await page.getByLabel('Jev’s address').fill(JEV_ADDRESS ?? '')
		await page.getByRole('button', { name: 'Check and save' }).click()
		await expect(page.getByText(/^Runs use the key ending/)).toBeVisible({ timeout: 30_000 })

		// Before the first evaluation: the way in, and no demo to try.
		await page.goto('/evaluations')
		await expect(page.getByRole('link', { name: 'Try the demo' })).toHaveCount(0)
		await page.getByRole('button', { name: 'New evaluation' }).first().click()
		const dialog = page.getByRole('dialog', { name: 'New evaluation' })
		await dialog.getByLabel('Name').fill('Sample files')
		await dialog.getByRole('button', { name: 'Create evaluation' }).click()
		await page.waitForURL('**/records')
		await page.locator('input[type=file]').setInputFiles(`${SAMPLES}/pairsight-sample-records.csv`)
		await expect(page.getByText(/^We matched \d+ fields? to your/)).toBeVisible()
		await page.getByRole('button', { name: 'Next: vendors' }).click()
		await page.waitForURL('**/vendors')

		await page.getByRole('button', { name: 'Add vendor' }).click()
		await page
			.locator('input[type=file]')
			.setInputFiles(`${SAMPLES}/pairsight-sample-vendor-pairs.csv`)
		const complete = page.getByRole('checkbox', { name: /^Yes, this file has all of Vendor A/ })
		await expect(complete).toBeEnabled({ timeout: 30_000 })
		await complete.click()
		await expect(complete).toBeChecked({ timeout: 30_000 })

		await page.getByRole('link', { name: 'Next: what Jev checks' }).click()
		await page.waitForURL('**/rules')
		await expect(page.getByText('Saved', { exact: true })).toBeVisible()
		await page.getByRole('link', { name: 'Check and start', exact: true }).click()
		await page.waitForURL('**/plan')
		// Suggested pairs come from the image's own Splink.
		await expect(page.getByText('Still looking at your records…')).toHaveCount(0, {
			timeout: 120_000
		})
		await page.getByRole('button', { name: 'Start run' }).click()
		await page.waitForURL(/\/runs\/[0-9a-f-]+\/results/, { timeout: 120_000 })
		await expect(
			page.getByRole('dialog', { name: 'Runs' }).getByRole('radio', { name: /^Completed/ })
		).toBeChecked()
	})
})
