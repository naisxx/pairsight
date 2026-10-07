// The match weight a pair needs to be picked. On the benchmark
// (scripts/splink-spike/, docs/PairSight-Scale-Roadmap.md items 5 and 10),
// pairs at or above 0 held about 90% of the planted people duplicates at 10K
// and 100K records, at a fraction of the pairs the old close-match rules
// needed, and beat the old rules for organisations and products at every
// size tried. Its own module, free of server-only imports, so the demo
// scripts read the same floor.
export const SPLINK_PLAN_FLOOR = 0
