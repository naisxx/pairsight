// The half of the Content-Security-Policy that never changes: no framing
// (clickjacking), no <base> or form posts to another origin, no plugins.
// next.config.ts sends it on every response; src/proxy.ts sends it again on
// pages with the script half added, because a page's CSP header from the
// proxy replaces the config's rather than joining it.
export const FIXED_CSP =
	"frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'"

// The request header src/proxy.ts puts this page view's script nonce in, for
// the layout to hand to the scripts Next doesn't stamp itself (next-themes).
export const NONCE_HEADER = 'x-nonce'

// The request header src/proxy.ts sets to 'dark' on the landing page, which
// is dark until someone picks a theme; the layout hands it to next-themes.
export const THEME_DEFAULT_HEADER = 'x-theme-default'
