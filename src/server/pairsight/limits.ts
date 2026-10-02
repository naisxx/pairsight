import { MAX_FILE_BYTES } from '@/lib/pairsight/tabular-formats'

// Initial v1 limits (docs/PairSight-V1-Scope.md). Adjust after the real Jev
// integration test; every check reads from here.
export const LIMITS = {
	maxFileBytes: MAX_FILE_BYTES,
	maxSourceRecords: 500,
	maxColumns: 40,
	maxVendors: 3,
	maxPairsPerRun: 5_000,
	bucketWarningSize: 50
} as const

// Validation issue lists show this many rows, then "and N more".
export const MAX_LISTED_ISSUES = 20
