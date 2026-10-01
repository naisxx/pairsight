// Why Jev couldn't judge a pair, in the user's terms. The run engine stores a
// raw code on the assessment (`http_422`, `timeout`, …); screens group and
// label failures by these reasons instead of showing the code.

export const FAILURE_REASONS = [
	'rejected',
	'rate_limited',
	'unavailable',
	'timeout',
	'network',
	'invalid_response',
	'unknown'
] as const

export type FailureReason = (typeof FAILURE_REASONS)[number]

const HTTP_CODE = /^http_(\d{3})$/
const HTTP_TOO_MANY_REQUESTS = 429
const HTTP_FIRST_SERVER_ERROR = 500

export function failureReason(errorCode: string | null | undefined): FailureReason {
	if (errorCode === 'timeout' || errorCode === 'network' || errorCode === 'invalid_response') {
		return errorCode
	}
	const status = Number(HTTP_CODE.exec(errorCode ?? '')?.[1])
	if (Number.isNaN(status)) return 'unknown'
	if (status === HTTP_TOO_MANY_REQUESTS) return 'rate_limited'
	if (status >= HTTP_FIRST_SERVER_ERROR) return 'unavailable'
	return 'rejected'
}
