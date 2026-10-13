import 'server-only'
import { env } from '@/lib/env'

// Whether this copy runs on a customer's own machine (PAIRSIGHT_DEPLOYMENT,
// docs/PairSight-OnPrem.md) rather than as the hosted app.
export function isOnPrem(): boolean {
	return env.PAIRSIGHT_DEPLOYMENT === 'onprem'
}
