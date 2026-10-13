import { expect, test, type Page } from '@playwright/test'
import { failOnCspViolations } from './csp'

// The landing's walkthrough is driven from the scroll position by script
// (src/components/pairsight/landing/scroll-scene.ts), so it must play the
// same in Chromium, WebKit and Firefox: this spec runs in all three
// (playwright.config.ts). Under 900px, or with less motion, it stacks.

failOnCspViolations()

const scene = (page: Page, word: string) =>
	page.locator('.landing-scene').filter({ has: page.getByRole('heading', { name: word }) })

const opacity = (page: Page, word: string) =>
	scene(page, word).evaluate((element) => Number(getComputedStyle(element).opacity))

// Scrolls so the walkthrough is `progress` of the way through its pinned run.
async function scrollWalkthrough(page: Page, progress: number) {
	await page.evaluate((share) => {
		const story = document.querySelector<HTMLElement>('[data-timeline-subject="story"]')
		if (story == null) return
		const top = story.getBoundingClientRect().top + window.scrollY
		const run = story.offsetHeight - document.documentElement.clientHeight
		window.scrollTo(0, Math.round(top + share * run))
	}, progress)
}

test.describe('wide, with motion', () => {
	test.use({ viewport: { width: 1440, height: 900 } })

	test('the walkthrough pins and plays Narrow, Blind and Open in turn', async ({ page }) => {
		await page.goto('/')
		await expect(page.locator('[data-landing]')).toHaveClass(/landing-motion/)
		await expect(page.locator('.landing-pin')).toHaveCSS('position', 'sticky')

		// Narrow: the count runs down from every possible pair.
		await scrollWalkthrough(page, 0.12)
		await expect.poll(() => opacity(page, 'Narrow.')).toBeGreaterThan(0.95)
		await expect.poll(() => opacity(page, 'Blind.')).toBeLessThan(0.05)
		const counter = page.locator('[data-count-to]')
		await expect
			.poll(async () => Number((await counter.textContent())?.replace(/\D/g, '')))
			.toBeGreaterThan(286)
		await scrollWalkthrough(page, 0.28)
		await expect(counter).toHaveText('286')

		// Blind.
		await scrollWalkthrough(page, 0.45)
		await expect.poll(() => opacity(page, 'Blind.')).toBeGreaterThan(0.95)
		await expect.poll(() => opacity(page, 'Narrow.')).toBeLessThan(0.05)

		// Open: the pair laid out, its verdict last.
		await scrollWalkthrough(page, 1)
		await expect.poll(() => opacity(page, 'Open.')).toBeGreaterThan(0.95)
		await expect.poll(() => opacity(page, 'Blind.')).toBeLessThan(0.05)
		await expect(scene(page, 'Open.').getByText('Jev says same.')).toBeVisible()
	})
})

test.describe('narrow', () => {
	test.use({ viewport: { width: 800, height: 900 } })

	test('under 900px the three scenes stack, finished', async ({ page }) => {
		await page.goto('/')
		await expect(page.locator('[data-landing]')).toHaveClass(/landing-motion/)
		await expect(page.locator('.landing-pin')).toHaveCSS('position', 'static')
		for (const word of ['Narrow.', 'Blind.', 'Open.']) {
			expect(await opacity(page, word)).toBe(1)
		}
		await expect(page.locator('[data-count-to]')).toHaveText('286')
	})
})

test.describe('less motion', () => {
	test.use({ viewport: { width: 1440, height: 900 }, contextOptions: { reducedMotion: 'reduce' } })

	test('nothing moves, and every part shows its settled state', async ({ page }) => {
		await page.goto('/')
		await page.waitForLoadState('networkidle')
		await expect(page.locator('[data-landing]')).not.toHaveClass(/landing-motion/)
		await expect(page.locator('.landing-pin')).toHaveCSS('position', 'static')
		for (const word of ['Narrow.', 'Blind.', 'Open.']) {
			expect(await opacity(page, word)).toBe(1)
		}
		const running = await page.evaluate(
			() => document.getAnimations().filter((animation) => animation.playState === 'running').length
		)
		expect(running).toBe(0)
		// The vendor switch waits for a visitor.
		await expect(page.locator('.landing-vendor-timer')).toHaveCount(0)
	})
})
