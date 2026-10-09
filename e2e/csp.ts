import { expect, test, type Page } from '@playwright/test'

// Fails each test in the calling file that hit a Content-Security-Policy
// violation (src/proxy.ts). A blocked script leaves a page half-working
// without anything else failing, so the browser's report is the check.
// Chromium files each one as a console error naming the policy.
export function failOnCspViolations() {
	const violations = new WeakMap<Page, string[]>()
	test.beforeEach(({ page }) => {
		const seen: string[] = []
		violations.set(page, seen)
		page.on('console', (message) => {
			if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
				seen.push(message.text())
			}
		})
	})
	test.afterEach(({ page }) => {
		expect(violations.get(page)).toEqual([])
	})
}
