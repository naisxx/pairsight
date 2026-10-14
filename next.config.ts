import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { withSentryConfig } from '@sentry/nextjs'
import { FIXED_CSP } from './src/lib/csp'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// Sent with every response (docs/rules/secrets.md covers what this isn't: a
// substitute for keeping secrets server-side). The CSP here is the fixed half
// (src/lib/csp.ts); pages get the script half too, from src/proxy.ts, since
// it needs a nonce per page view.
// HSTS is the host's to send: on Vercel it's set on every HTTPS domain.
const SECURITY_HEADERS = [
	{
		key: 'Content-Security-Policy',
		value: FIXED_CSP
	},
	// For browsers that predate frame-ancestors.
	{ key: 'X-Frame-Options', value: 'DENY' },
	{ key: 'X-Content-Type-Options', value: 'nosniff' },
	{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
	// Nothing in PairSight asks for these; nothing embedded can either.
	{
		key: 'Permissions-Policy',
		value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()'
	},
	// Own browsing context group: no other site's window can reach this one.
	{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
]

const isOnPremBuild = process.env.PAIRSIGHT_DEPLOYMENT === 'onprem'

const nextConfig: NextConfig = {
	reactStrictMode: true,
	// The on-prem image (deploy/onprem/Dockerfile) ships only the files the
	// server loads, traced by the build; hosted builds stay as they are.
	output: isOnPremBuild ? 'standalone' : undefined,
	// Fixed into the bundle at build. The landing page and the demo are the
	// marketing site: hosted and local dev have them, the on-prem build
	// doesn't (docs/PairSight-OnPrem.md, "What the image ships"). Code
	// behind `process.env.PAIRSIGHT_MARKETING !== 'off'` is dropped from it.
	env: {
		PAIRSIGHT_MARKETING: isOnPremBuild ? 'off' : 'on'
	},
	// Don't announce the framework (and its version range) on every response.
	poweredByHeader: false,
	async headers() {
		return [{ source: '/:path*', headers: SECURITY_HEADERS }]
	},
	// Top-level as of Next.js 16, not under `experimental`. Strictest
	// setting: any Compiler bailout fails the build instead of silently
	// skipping optimization for that component. Matches 8x-core and
	// 8x-brands — catch Compiler-incompatible code at build time, not as a
	// silent perf regression in prod.
	reactCompiler: {
		panicThreshold: 'all_errors'
	},
	// Files never go through a server action: they're uploaded once to
	// PUT /api/evaluations/[id]/uploads (src/server/api/pairsight/uploads.ts),
	// so actions only carry choices. Next's default limit is enough.
	experimental: {
		serverActions: { bodySizeLimit: '1mb' }
	},
	// Messages are read from disk at request time (src/i18n/request.ts), not
	// imported, so the build's file trace must be told to ship them.
	outputFileTracingIncludes: {
		'/**': ['./messages/**/*.json']
	}
}

export default withSentryConfig(withNextIntl(nextConfig), {
	org: process.env.SENTRY_ORG,
	project: process.env.SENTRY_PROJECT,
	silent: !process.env.CI,
	widenClientFileUpload: true
	// disableLogger is deprecated and unsupported under Turbopack (our
	// default bundler) — Sentry's tree-shaking of its own debug logging
	// happens automatically now, nothing to configure here.
})
