import 'server-only'
import { env } from '@/lib/env'
import { trackAiCall } from '@/server/lib/ai-usage/sink'
import type { TrackedModel } from '@/server/lib/ai-usage/models'
import type { AiUsageMeta } from '@/server/lib/ai-usage/track'
import { getJevCredentials, type JevCredentials } from './jev-credentials'
import { retryAfterMs } from './retry-after'

// TypeSafe's System One API (the Jev decision model). The only file that calls
// it, and the only place its usage is tracked — same layering as anthropic.ts
// (docs/rules/ai-usage.md). There is no SDK: the API is a single JSON POST,
// documented at https://docs.typesafe.ai/api. Feature code never calls this
// directly; PairSight's run engine builds the request (src/server/pairsight/
// judgment.ts) and hands it here.

export type NoulQuestion = {
	type: 'noul'
	instructions: string
	criteria?: { true: string; false: string }
}

export type DecisionRequest = {
	state: Record<string, unknown>
	questions: Record<string, NoulQuestion>
}

// `config`: no call can succeed until someone fixes the setup (a missing,
// rejected or forbidden key). `bad_body`: a 2xx whose body isn't JSON (cut
// off, or a proxy's page). The run engine decides what each means
// (src/server/pairsight/judgment.ts classifyFailure).
export type TypesafeFailureKind = 'config' | 'http' | 'timeout' | 'network' | 'bad_body'

export class TypesafeError extends Error {
	readonly kind: TypesafeFailureKind
	readonly status: number | undefined
	// How long Jev asked us to wait (a Retry-After header), when it said.
	readonly retryAfterMs: number | null

	constructor({
		kind,
		status,
		retryAfterMs = null,
		message
	}: {
		kind: TypesafeFailureKind
		status?: number
		retryAfterMs?: number | null
		message: string
	}) {
		super(message)
		this.name = 'TypesafeError'
		this.kind = kind
		this.status = status
		this.retryAfterMs = retryAfterMs
	}
}

// A failed fetch or body read: a timeout, or the connection dropping.
function transportError(error: unknown, stage: 'request' | 'body'): TypesafeError {
	const isTimeout = error instanceof Error && error.name === 'TimeoutError'
	return new TypesafeError({
		kind: isTimeout ? 'timeout' : 'network',
		message: `TypeSafe ${stage} ${isTimeout ? 'timed out' : 'failed'}`
	})
}

export type DecisionContext = {
	feature: string
	model: TrackedModel
	meta?: AiUsageMeta
}

/**
 * A tracked System One decision call, with this server's Jev key and address
 * unless others are given. Returns the parsed JSON body untouched
 * (callers validate it — the shape is an external contract) and throws
 * `TypesafeError` for anything else, never a plain error: a non-2xx (with
 * Jev's Retry-After), a timeout or dropped connection at any point, a body
 * that isn't JSON.
 */
export async function requestDecision(
	context: DecisionContext,
	request: DecisionRequest,
	// A key and address to try instead of this server's (jev-credentials.ts):
	// the Settings page checks a key this way before it's saved.
	credentials?: JevCredentials
): Promise<unknown> {
	const jev = credentials ?? (await getJevCredentials())
	if (jev == null) {
		throw new TypesafeError({ kind: 'config', message: 'No Jev key is set up' })
	}
	const { apiKey, baseUrl } = jev

	return trackAiCall({ provider: 'typesafe', ...context }, async () => {
		// One deadline for the whole call, body included: a body that stops
		// arriving times out like a request that never answers.
		const signal = AbortSignal.timeout(env.TYPESAFE_TIMEOUT_MS)
		let response: Response
		try {
			response = await fetch(`${baseUrl}/systemone`, {
				method: 'POST',
				headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
				body: JSON.stringify({ model: context.model, ...request }),
				signal
			})
		} catch (error) {
			throw transportError(error, 'request')
		}
		if (response.status === 401 || response.status === 403) {
			throw new TypesafeError({
				kind: 'config',
				status: response.status,
				message: `TypeSafe refused the API key (${response.status})`
			})
		}
		if (!response.ok) {
			throw new TypesafeError({
				kind: 'http',
				status: response.status,
				retryAfterMs: retryAfterMs(response.headers.get('retry-after')),
				message: `TypeSafe responded ${response.status}`
			})
		}
		let text: string
		try {
			text = await response.text()
		} catch (error) {
			throw transportError(error, 'body')
		}
		try {
			const body: unknown = JSON.parse(text)
			return body
		} catch {
			throw new TypesafeError({
				kind: 'bad_body',
				message: 'TypeSafe sent a body that is not JSON'
			})
		}
	})
}
