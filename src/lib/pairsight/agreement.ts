import type { VendorMetrics } from './metrics'

// Pairs where the vendor and Jev agree: both say same, or both say different.
// A supporting number on the verdict and the vendor cards; vendors are ranked
// by their overall score (ranking.ts), never by this.
export function agreedCount(metrics: VendorMetrics): number {
	return metrics.counts.both_matched + metrics.counts.neither_matched
}
