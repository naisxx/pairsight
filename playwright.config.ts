import { defineConfig, devices } from '@playwright/test'

const isPairsight = process.env.E2E_PAIRSIGHT === '1'
const JEV_STUB_PORT = 4010

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	// A cold run compiles routes on demand per worker, which can take longer
	// than Playwright's 30s default before anything is warm — an expiry there
	// reads as a spurious failure rather than a real one.
	timeout: 60_000,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	// Boots the app itself for local runs; CI (and any review skill running
	// against an already-live URL via E2E_BASE_URL) should skip this by
	// setting E2E_BASE_URL and leaving webServer unused — see
	// .claude/skills/e2e-review/SKILL.md.
	//
	// PairSight flow specs (e2e/pairsight.spec.ts) need local Supabase and the
	// Jev stub; opt in with E2E_PAIRSIGHT=1. The stub replaces TypeSafe, so no
	// key is used and nothing leaves the machine.
	webServer: [
		...(isPairsight
			? [
					{
						command: 'node scripts/jev-stub.mjs',
						url: `http://127.0.0.1:${JEV_STUB_PORT}/health`,
						reuseExistingServer: !process.env.CI
					}
				]
			: []),
		...(process.env.E2E_BASE_URL
			? []
			: [
					{
						command: 'pnpm dev',
						url: 'http://localhost:3000',
						// PairSight specs need this server's stub env. Reusing whatever
						// already listens on 3000 (often a dev server Playwright left
						// running on Windows) would send real Jev calls instead, so
						// they fail loudly on a busy port rather than reuse it.
						reuseExistingServer: !process.env.CI && !isPairsight,
						timeout: 60_000,
						env: isPairsight
							? {
									TYPESAFE_API_BASE_URL: `http://127.0.0.1:${JEV_STUB_PORT}/v1`,
									TYPESAFE_API_KEY: 'e2e-stub-key'
								}
							: {}
					}
				])
	]
})
