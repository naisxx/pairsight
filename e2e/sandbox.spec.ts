import { execSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'

// The public sandbox (/sandbox): the whole app, read-only, on the prepared
// evaluation from `pnpm demo:seed`. Needs the local database, so it's opt-in
// like the PairSight slice (E2E_PAIRSIGHT=1).

const PASSWORD = 'e2e-password-123'
const SIGN_UP = /^Sign up to /

test.describe('Sandbox', () => {
	test.skip(process.env.E2E_PAIRSIGHT !== '1', 'Needs local Supabase: set E2E_PAIRSIGHT=1')
	test.describe.configure({ mode: 'serial' })

	// Seeding twice must leave the same sandbox: the seed is idempotent.
	test.beforeAll(() => {
		execSync('pnpm -s demo:seed', { stdio: 'ignore' })
		execSync('pnpm -s demo:seed', { stdio: 'ignore' })
	})

	const pipeline = (page: Page) => page.getByRole('list', { name: 'Pipeline' })
	const step = (page: Page, name: string) =>
		pipeline(page).getByRole('link', { name: new RegExp(`^${name},`) })

	test('signed out, every step opens read-only, from the landing page', async ({ page }) => {
		await page.goto('/')
		await page.getByRole('link', { name: 'Explore the sandbox' }).first().click()
		await page.waitForURL((url) => url.pathname === '/sandbox')
		await expect(page.getByRole('note', { name: 'About the sandbox' })).toContainText(
			/fictional data · read-only\. Judgments recorded from Jev/
		)
		await expect(page.getByRole('link', { name: 'Sign up', exact: true })).toBeVisible()

		// Records: the saved file, Replace is for accounts.
		await step(page, 'Records').click()
		await page.waitForURL('**/sandbox/records')
		await expect(page.getByRole('heading', { name: 'Column mapping' })).toBeVisible()
		await expect(page.getByLabel('Sign up to upload your own records')).toBeVisible()

		// Vendors: both vendors, viewable; adding one needs an account.
		await step(page, 'Vendors').click()
		await page.waitForURL('**/sandbox/vendors')
		const vendors = page.getByRole('navigation', { name: 'Vendors' })
		await expect(vendors).toContainText('Pair format · ready')
		await expect(vendors).toContainText('Group format · ready')
		await expect(page.getByLabel('Sign up to add or change vendors')).toBeVisible()
		await expect(page.getByLabel('Vendor name')).toBeDisabled()

		// Rules: shown, not editable, and never saved.
		await step(page, 'Rules').click()
		await page.waitForURL('**/sandbox/rules')
		await expect(page.getByRole('switch', { name: 'Same email rule' })).toBeDisabled()
		await expect(page.getByLabel('Counts as the same individual')).toBeDisabled()
		await expect(page.getByText('Sandbox · changes aren’t saved')).toBeVisible()

		// Plan: the ledger, but starting a run needs an account.
		await page.getByRole('link', { name: 'Review comparison plan' }).click()
		await page.waitForURL('**/sandbox/plan')
		await expect(page.getByRole('region', { name: 'From records to pairs' })).toBeVisible()
		await expect(page.getByLabel('Sign up to start a run')).toBeVisible()

		// Run: the prepared run, complete.
		await step(page, 'Run').click()
		await page.waitForURL(/\/sandbox\/runs\/[0-9a-f-]+$/)
		await expect(page.getByText('Run complete', { exact: true })).toBeVisible()
		await expect(page.getByText('8 / 8', { exact: true })).toBeVisible()
	})

	test('clicking the evaluation row opens it where it is up to: its results', async ({ page }) => {
		await page.goto('/sandbox')
		const row = page.locator('tbody tr', {
			has: page.getByRole('link', { name: 'Customer master — vendor check' })
		})
		// A cell, not the name link: the whole row opens it.
		await row.locator('td').nth(2).click()
		await page.waitForURL(/\/sandbox\/runs\/[0-9a-f-]+\/results/)
	})

	test('results and pairs: filters and the threshold preview work, nothing is saved', async ({
		page
	}) => {
		await page.goto('/sandbox/results')
		await page.waitForURL(/\/sandbox\/runs\/[0-9a-f-]+\/results/)
		const tile = (name: string) =>
			page
				.getByRole('region', { name: 'Pairs by category' })
				.getByRole('link', { name: new RegExp(`^${name}: `) })
		for (const name of ['Both matched', 'PairSight only', 'Vendor only', 'Neither matched']) {
			await expect(tile(name)).toBeVisible()
		}

		// The threshold previews live; saving it is for accounts.
		await page.getByRole('button', { name: /^Decision threshold/ }).click()
		const value = page.getByLabel('Threshold value')
		await value.fill('0.90')
		await value.press('Enter')
		await expect(page.getByRole('dialog')).toContainText('becomes')
		await expect(page.getByLabel('Sign up to save a threshold')).toBeVisible()
		await page.keyboard.press('Escape')
		await page.reload()
		await expect(page.getByRole('button', { name: /^Decision threshold 0\.50/ })).toBeVisible()

		// Filters are just the URL, so they work; a pair opens, and J moves on.
		await tile('PairSight only').click()
		await page.waitForURL(/category=pairsight_only/)
		await page.locator('[data-pairs-table] a[href*="/pairs/"]').first().click()
		await page.waitForURL(/\/sandbox\/runs\/[0-9a-f-]+\/pairs\//)
		await expect(page.getByRole('region', { name: 'Decisions', exact: true })).toContainText(
			'PairSight (AI)Match'
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
		await page.getByRole('link', { name: 'Explore the sandbox' }).click()
		await page.waitForURL((url) => url.pathname === '/sandbox')

		await expect(page.getByRole('button', { name: 'Account: Sandbox Visitor' })).toBeVisible()
		await expect(page.getByRole('link', { name: 'Your evaluations' })).toBeVisible()
		// Only the prepared evaluation, and no way to rename or delete it.
		await expect(page.getByLabel('Summary')).toContainText(/Evaluations\s*1/)
		await page.getByRole('button', { name: /^Actions for / }).click()
		await expect(page.getByRole('menuitem', { name: 'Open' })).toBeVisible()
		await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0)
		await expect(page.getByLabel(SIGN_UP)).toHaveCount(0)
	})
})
