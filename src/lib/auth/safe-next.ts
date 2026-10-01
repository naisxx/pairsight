// Where to go after signing in or onboarding. Only same-site paths: `next`
// comes from the URL, so anything else would be an open redirect. Browsers
// read `/\` like `//` (protocol-relative), so that's refused too.

const DEFAULT_AFTER_SIGN_IN = '/evaluations'

export function safeNext(next: string | undefined): string {
	return next != null && next.startsWith('/') && next[1] !== '/' && next[1] !== '\\'
		? next
		: DEFAULT_AFTER_SIGN_IN
}
