import 'server-only'
import type { LandingVendor } from './landing-demo'

// The demo's recorded vendors, best first, as the sign-in page and the empty
// dashboard preview them, or null in a build without the marketing site
// (on-prem). PAIRSIGHT_MARKETING is fixed at build (next.config.ts), so an
// on-prem build drops this branch, and with it landing-demo.ts and the
// demo's snapshots.
export async function demoPreview(): Promise<LandingVendor[] | null> {
	if (process.env.PAIRSIGHT_MARKETING !== 'off') {
		const { landingDemo } = await import('./landing-demo')
		return landingDemo().vendors
	}
	return null
}
