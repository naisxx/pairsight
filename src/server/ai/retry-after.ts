// A `Retry-After` header as milliseconds to wait: either whole seconds or an
// HTTP date (RFC 9110). Null when it's missing or unreadable, or already
// past. Pure, so the run engine's waiting is tested without real time.
const MS_PER_SECOND = 1_000

export function retryAfterMs(header: string | null, now = Date.now()): number | null {
	if (header == null) return null
	const value = header.trim()
	if (value === '') return null
	if (/^\d+$/.test(value)) return Number(value) * MS_PER_SECOND
	const at = Date.parse(value)
	if (Number.isNaN(at)) return null
	const wait = at - now
	return wait > 0 ? wait : null
}
