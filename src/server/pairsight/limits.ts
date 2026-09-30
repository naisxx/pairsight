// Initial v1 limits (docs/PairSight-V1-Scope.md). Adjust after the real Jev
// integration test; every check reads from here.
export const LIMITS = {
	maxFileBytes: 1_000_000,
	maxSourceRecords: 500,
	maxColumns: 40,
	maxVendors: 3,
	maxPairsPerRun: 5_000,
	bucketWarningSize: 50
} as const

// Validation issue lists show this many rows, then "and N more".
export const MAX_LISTED_ISSUES = 20
