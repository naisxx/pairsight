import 'server-only'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { env } from '@/lib/env'
import { log as rootLog } from '@/server/lib/logger'

// How PairSight runs the Splink service (services/splink,
// docs/rules/splink-service.md): one process per dataset, files in and out,
// no shell. The only place in the app that starts a process.

const SERVICE_DIR = path.join(process.cwd(), 'services', 'splink')
// The service's summary and logs are small; this is a generous ceiling.
const OUTPUT_LIMIT_BYTES = 10 * 1024 * 1024
// A relayed log line is cut to this many characters.
const LOG_DETAIL_CHARS = 1_000

const log = rootLog.child({ source: 'splink' })

// The Python that runs the service: SPLINK_PYTHON, else the venv made by
// `pnpm splink:setup`, else none (Splink is off on this server).
export function splinkPython(): string | null {
	if (env.SPLINK_PYTHON != null && env.SPLINK_PYTHON !== '') return env.SPLINK_PYTHON
	const venv = path.join(
		SERVICE_DIR,
		'.venv',
		process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
	)
	return existsSync(venv) ? venv : null
}

const summarySchema = z.object({
	records: z.number().int(),
	skipped: z.string().optional(),
	pairs_scored: z.number().int().optional(),
	pairs_kept: z.number().int().default(0),
	splink: z.string(),
	duckdb: z.string(),
	seconds: z.record(z.string(), z.number()).optional(),
	seconds_total: z.number().optional()
})
export type SplinkSummary = z.infer<typeof summarySchema>

const logLineSchema = z.object({ level: z.string(), message: z.string() })

// Passes the service's own log lines (JSON on stderr) on to ours.
function relayLogs(stderr: string) {
	for (const line of stderr.split('\n')) {
		if (line.trim() === '') continue
		const parsed = logLineSchema.safeParse(safeJson(line))
		if (!parsed.success) {
			log.warn('splink service output', { detail: line.slice(0, LOG_DETAIL_CHARS) })
			continue
		}
		const detail = parsed.data.message.slice(0, LOG_DETAIL_CHARS)
		if (parsed.data.level === 'error') log.error('splink service error', { detail })
		else if (parsed.data.level === 'warning') log.warn('splink service warning', { detail })
		else log.info('splink service', { detail })
	}
}

function safeJson(text: string): unknown {
	try {
		return JSON.parse(text)
	} catch {
		return null
	}
}

// Scores the records file into the pairs file; resolves with the service's
// summary, rejects if it fails, times out or says something unreadable.
export function runSplink({
	python,
	recordsPath,
	outPath,
	maxPairs
}: {
	python: string
	recordsPath: string
	outPath: string
	maxPairs: number
}): Promise<SplinkSummary> {
	const args = [
		'-m',
		'pairsight_splink',
		'score',
		'--records',
		recordsPath,
		'--out',
		outPath,
		'--max-pairs',
		String(maxPairs),
		'--memory-limit',
		env.SPLINK_MEMORY_LIMIT
	]
	return new Promise((resolve, reject) => {
		execFile(
			python,
			args,
			{
				cwd: SERVICE_DIR,
				timeout: env.SPLINK_TIMEOUT_MS,
				maxBuffer: OUTPUT_LIMIT_BYTES,
				windowsHide: true
			},
			(error, stdout, stderr) => {
				relayLogs(stderr)
				if (error != null) {
					reject(error)
					return
				}
				const lastLine = stdout.trim().split('\n').at(-1) ?? ''
				const summary = summarySchema.safeParse(safeJson(lastLine))
				if (summary.success) resolve(summary.data)
				else reject(new Error('The Splink service gave no readable summary'))
			}
		)
	})
}
