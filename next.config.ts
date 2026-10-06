import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { withSentryConfig } from '@sentry/nextjs'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
	reactStrictMode: true,
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
