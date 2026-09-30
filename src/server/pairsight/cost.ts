// A rough cost preview for the Plan screen, clearly labeled as an estimate:
// the tutorial's example call used ~476 input tokens, and the rate is
// OpenRouter's listing for typesafe/jev-1.13, the approved stand-in until
// TypeSafe publishes its own price (docs/PairSight-V1-Scope.md).
const ESTIMATED_TOKENS_PER_PAIR = 500
const STAND_IN_USD_PER_INPUT_TOKEN = 0.000000042

export function estimateCostUsd(pairs: number): number {
	return pairs * ESTIMATED_TOKENS_PER_PAIR * STAND_IN_USD_PER_INPUT_TOKEN
}
