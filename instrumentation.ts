import * as Sentry from '@sentry/nextjs'
import { PHASE_PRODUCTION_BUILD } from 'next/constants'

export async function register() {
	if (process.env.NEXT_RUNTIME === 'nodejs') {
		await import('./sentry.server.config')

		// Sentry silently no-ops without a DSN, so a deployment that forgot to
		// set one reports nothing and looks healthy. Warn once at boot (Node
		// runtime only, so it's one line per instance, not one per runtime)
		// rather than discovering it the first time an error goes missing.
		if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
			const { log } = await import('./src/server/lib/logger')
			log.warn('error reporting disabled: NEXT_PUBLIC_SENTRY_DSN is unset')
		}

		// Validates every env var declared in src/lib/env.ts and throws with a
		// clear message if one's missing/malformed — runs once per server
		// instance (register() fires on boot, not per-request), so a
		// misconfigured deployment fails immediately instead of surfacing as
		// an obscure runtime error three requests later.
		await import('./src/lib/env')

		// One line naming every service outside this machine the server will
		// contact: on-prem, that should be Jev alone (docs/PairSight-OnPrem.md).
		const { logOutboundServices } = await import('./src/server/outbound')
		logOutboundServices()

		// PairSight's background run worker: runs keep going with no page
		// open. Started without waiting, since register() has to finish before
		// the server takes requests, and never during `next build`, which
		// loads this file to prerender but serves nothing.
		if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
			const { startRunWorker } = await import('./src/server/pairsight/worker/run-worker')
			startRunWorker()
		}
	}
	if (process.env.NEXT_RUNTIME === 'edge') {
		await import('./sentry.edge.config')
	}
}

export const onRequestError = Sentry.captureRequestError
