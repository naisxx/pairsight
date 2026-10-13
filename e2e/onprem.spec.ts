import { expect, test, type Browser, type Page } from '@playwright/test'
import { failOnCspViolations } from './csp'

failOnCspViolations()

// PairSight on a customer's own machine (docs/PairSight-OnPrem.md), against a
// server with PAIRSIGHT_DEPLOYMENT=onprem and an EMPTY database: the first
// account becomes the admin, admins manage who else is one in Settings, and
// the privacy page says what stays on the machine. Opt in with E2E_ONPREM=1;
// it must be the only spec run against that server, in order.

const PASSWORD = 'e2e-password-123'

test.describe.configure({ mode: 'serial' })

test.describe('On-prem', () => {
	test.skip(process.env.E2E_ONPREM !== '1', 'Needs an on-prem server on an empty database')

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
		await signUp(page, name)
		await page.goto('/settings')
		return page
	}

	test('the first account is the admin, and admins decide who else is', async ({ browser }) => {
		const first = await newPerson(browser, 'First Admin')
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
		const second = await newPerson(browser, 'Second Person')
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
})
