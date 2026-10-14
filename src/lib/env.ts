import { z } from 'zod'

// Single source of truth for every environment variable the app reads.
// Fails fast at boot with a clear message instead of a runtime `undefined`
// surfacing three layers deep. Keep this in sync with .env.example —
// `pnpm check:env` (scripts/check-env-vars.mjs) fails CI if a
// process.env reference exists in code without a matching entry here.
const envSchema = z.object({
	DATABASE_URL: z.string().url(),
	// Where this copy runs (docs/PairSight-OnPrem.md). `onprem`: on a
	// customer's own machine, so nothing but Jev calls leaves it (AI usage is
	// priced from the bundled rate card), the first account becomes the
	// admin, and admins manage people in Settings.
	PAIRSIGHT_DEPLOYMENT: z.enum(['hosted', 'onprem']).default('hosted'),
	// Whether this build has the marketing site, the landing page and the
	// demo. Set by next.config.ts at build from PAIRSIGHT_DEPLOYMENT (`off`
	// on-prem) and fixed into the bundle; never set it yourself. Code reads
	// process.env.PAIRSIGHT_MARKETING directly, so the build can drop it.
	PAIRSIGHT_MARKETING: z.enum(['on', 'off']).default('on'),
	// Only read by the Prisma CLI (`migrate dev`/`migrate deploy`), never by
	// the running app — so it's required in CI/local dev (where migrations
	// run) but optional here, or every Vercel deployment would be forced to
	// configure a variable the deployed app never actually uses.
	DIRECT_URL: z.string().url().optional(),

	// Optional so a landing-page clone (no accounts, see docs/rules/auth.md)
	// boots without them — proxy.ts and the Supabase clients themselves
	// no-op or fail open when these aren't set, never crash the app.
	NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal('')),
	NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional().or(z.literal('')),
	SUPABASE_SECRET_KEY: z.string().optional(),

	// Minimum severity the server logger emits (docs/rules/logging.md).
	// Validated here so a typo fails the boot loudly, but the logger reads
	// `process.env.LOG_LEVEL` directly (not `env.LOG_LEVEL`) so it can report a
	// bad boot before this schema has run. Defaults to `info`, or `silent`
	// under NODE_ENV=test.
	LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).optional().or(z.literal('')),

	NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal('')),
	SENTRY_ORG: z.string().optional(),
	SENTRY_PROJECT: z.string().optional(),

	NEXT_PUBLIC_POSTHOG_KEY: z.string().optional().or(z.literal('')),
	NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default('https://us.i.posthog.com'),
	POSTHOG_PERSONAL_API_KEY: z.string().optional(),

	// Optional — captureError() no-ops on Slack alerting entirely without
	// this. See docs/rules/error-handling.md.
	SLACK_ALERT_WEBHOOK_URL: z.string().url().optional().or(z.literal('')),

	NEXT_PUBLIC_DEFAULT_LOCALE: z.string().default('en'),

	// TypeSafe's Jev API (PairSight pair judgments). Optional so the app and
	// the prepared demo boot without it; starting a live run without a key is
	// reported to the user as a configuration error. The base URL is only
	// overridden by the e2e suite, which points it at a local stub.
	TYPESAFE_API_KEY: z.string().optional(),
	TYPESAFE_API_BASE_URL: z.string().url().default('https://api.typesafe.ai/v1'),
	// How long one Jev call may take before it's given up and tried again
	// later. Lowered only by the e2e suite, to test a call that never answers.
	TYPESAFE_TIMEOUT_MS: z.coerce.number().int().min(1).default(20_000),
	// Encrypts the Jev key an admin saves on the Settings page
	// (src/server/lib/secrets/crypto.ts): 32 random bytes, base64. Unset, a
	// key can't be saved there and runs use TYPESAFE_API_KEY (hosted only:
	// on-prem ignores it, docs/PairSight-OnPrem.md).
	PAIRSIGHT_SECRET_KEY: z
		.string()
		.refine((value) => value === '' || Buffer.from(value, 'base64').length === 32, {
			message: 'must be 32 random bytes, base64-encoded'
		})
		.optional(),
	// How many Jev calls the background run worker starts with at once,
	// shared across running runs (src/server/pairsight/worker). It adapts
	// from there: up to RUN_WORKER_CONCURRENCY_MAX while Jev answers cleanly,
	// down when it pushes back. Jev took 200 at once without pushing back
	// (docs/PairSight-Scale-Roadmap.md, item 4), so it starts at half that.
	// 0 turns the worker off, for a server that should serve pages only.
	RUN_WORKER_CONCURRENCY: z.coerce.number().int().min(0).default(100),
	// The most Jev calls at once the worker climbs to: the highest level Jev
	// took cleanly in the live speed test.
	RUN_WORKER_CONCURRENCY_MAX: z.coerce.number().int().min(1).default(200),
	// Which runs this server's worker takes: those started on a server with
	// the same pool. Servers sharing one database (a dev server and the e2e
	// server) keep apart by using different pools.
	RUN_WORKER_POOL: z.string().min(1).default('default'),

	// The Splink service (services/splink, docs/rules/splink-service.md): the
	// Python that runs it. Unset, the worker uses services/splink/.venv when
	// `pnpm splink:setup` has made one; with neither, Splink is off and plans
	// use rules and vendor pairs only. On-prem, a wrapper that runs the image.
	SPLINK_PYTHON: z.string().optional(),
	// DuckDB's memory cap inside the service; past it, it spills to disk.
	SPLINK_MEMORY_LIMIT: z.string().min(1).default('1500MB'),
	// How long scoring one dataset may take before it's stopped as failed.
	SPLINK_TIMEOUT_MS: z.coerce.number().int().min(1).default(300_000),

	// Required by cron routes only; an unset secret must not break unrelated pages.
	CRON_SECRET: z.string().optional(),

	NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

	// Attached as the app_version property on every analytics event — optional,
	// events just omit it when unset. See docs/rules/analytics.md.
	NEXT_PUBLIC_APP_VERSION: z.string().optional().or(z.literal(''))
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
	const parsed = envSchema.safeParse(process.env)
	if (!parsed.success) {
		console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
		throw new Error('Invalid environment variables — see console output above')
	}
	return parsed.data
}

export const env = loadEnv()
