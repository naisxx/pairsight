import 'server-only'
import { z } from 'zod'
import rateCardJson from './rate-card.json' with { type: 'json' }
import { openRouterRatesSchema, type RateCard } from './pricing'

// The rate card an on-prem install prices with instead of fetching
// OpenRouter's (scripts/build-rate-card.mjs, `pnpm ai:rate-card`): the
// mapped slugs' rates on the day it was built. Parsed once, at load, so a
// malformed file fails the server's boot rather than pricing calls as NULL.
const bundledSchema = z.object({
	fetchedAt: z.string(),
	rates: z.record(z.string(), openRouterRatesSchema)
})

export const BUNDLED_RATE_CARD: RateCard = new Map(
	Object.entries(bundledSchema.parse(rateCardJson).rates)
)
