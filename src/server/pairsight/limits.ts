import { MAX_FILE_BYTES } from '@/lib/pairsight/tabular-formats'

// The limits every check reads from here (docs/PairSight-V1-Scope.md, raised
// by docs/PairSight-Scale-Roadmap.md item 3: files are read and saved a batch
// at a time, so these are product limits, not memory ones).
export const LIMITS = {
	maxFileBytes: MAX_FILE_BYTES,
	maxSourceRecords: 10_000,
	// Rows in a vendor's file: its own limit, not the pair cap, since a run's
	// pairs are mostly what the comparison rules find.
	maxVendorRows: 100_000,
	maxColumns: 40,
	maxVendors: 3,
	maxPairsPerRun: 5_000,
	bucketWarningSize: 50
} as const

// Validation issue lists show this many rows, then "and N more".
export const MAX_LISTED_ISSUES = 20
