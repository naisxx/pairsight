import 'server-only'
import { env } from '@/lib/env'
import { trackAiCall } from '@/server/lib/ai-usage/sink'
import type { TrackedModel } from '@/server/lib/ai-usage/models'
import type { AiUsageMeta } from '@/server/lib/ai-usage/track'

// TypeSafe's System One API (the Jev decision model). The only file that calls
// it, and the only place its usage is tracked — same layering as anthropic.ts
// (docs/rules/ai-usage.md). There is no SDK: the API is a single JSON POST,
// documented at https://docs.typesafe.ai/api. Feature code never calls this
// directly; PairSight's run engine builds the request (src/server/pairsight/
// judgment.ts) and hands it here.

const REQUEST_TIMEOUT_MS = 20_000

export type NoulQuestion = {
	type: 'noul'
	instructions: string
	criteria?: { true: string; false: string }
}

export type DecisionRequest = {
	state: Record<string, unknown>
	questions: Record<string, NoulQuestion>
}

// `config` means no call can succeed until someone fixes the setup (missing
// or rejected key); the run engine stops the run instead of retrying.
export type TypesafeFailureKind = 'config' | 'http' | 'timeout' | 'network'

export class TypesafeError extends Error {
	readonly kind: TypesafeFailureKind
	readonly status: number | undefined

	constructor({
		kind,
		status,
		message
	}: {
		kind: TypesafeFailureKind
		status?: number
		message: string
	}) {
		super(message)
		this.name = 'TypesafeError'
		this.kind = kind
		this.status = status
	}
}

export type DecisionContext = {
	feature: string
	model: TrackedModel
	meta?: AiUsageMeta
}

/**
 * A tracked System One decision call. Returns the parsed JSON body untouched
 * (callers validate it — the shape is an external contract) and throws
 * `TypesafeError` for anything that isn't a 2xx response.
 */
export async function requestDecision(
	context: DecisionContext,
	request: DecisionRequest
): Promise<unknown> {
	const apiKey = env.TYPESAFE_API_KEY
	if (apiKey == null || apiKey === '') {
		throw new TypesafeError({ kind: 'config', message: 'TYPESAFE_API_KEY is not set' })
	}

	return trackAiCall({ provider: 'typesafe', ...context }, async () => {
		let response: Response
		try {
			response = await fetch(`${env.TYPESAFE_API_BASE_URL}/systemone`, {
				method: 'POST',
				headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
				body: JSON.stringify({ model: context.model, ...request }),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
			})
		} catch (error) {
			const isTimeout = error instanceof Error && error.name === 'TimeoutError'
			throw new TypesafeError({
				kind: isTimeout ? 'timeout' : 'network',
				message: isTimeout ? 'TypeSafe request timed out' : 'TypeSafe request failed'
			})
		}
		if (response.status === 401) {
			throw new TypesafeError({
				kind: 'config',
				status: 401,
				message: 'TypeSafe rejected the API key'
			})
		}
		if (!response.ok) {
			throw new TypesafeError({
				kind: 'http',
				status: response.status,
				message: `TypeSafe responded ${response.status}`
			})
		}
		const body: unknown = await response.json()
		return body
	})
}
