// Makes deploy/onprem/.env: the per-install secrets compose.yaml reads, each
// random and made here, never shipped. The Windows installer writes the same
// file its own way; this one is for trying the stack locally and for CI.
//
// Usage: node scripts/onprem-env.mjs [--image <ref>] [--port <n>] [--out <file>]
//
// Refuses to replace an existing file: its secrets already guard a database
// (and the Jev key saved in it), and new ones would lock that data out.

import { randomBytes } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

const SECRET_BYTES = 32
const DEFAULT_PORT = '3080'

const { values } = parseArgs({
	options: {
		image: { type: 'string', default: 'ghcr.io/8xplays/pairsight-onprem:latest' },
		port: { type: 'string', default: DEFAULT_PORT },
		out: { type: 'string', default: 'deploy/onprem/.env' }
	}
})

if (existsSync(values.out)) {
	console.error(`${values.out} already exists; its secrets guard that install's data. Left alone.`)
	process.exit(1)
}

// Hex for the passwords, so they sit in a database URL with nothing to escape.
const hex = () => randomBytes(SECRET_BYTES).toString('hex')

const lines = [
	`PAIRSIGHT_IMAGE=${values.image}`,
	`PAIRSIGHT_PORT=${values.port}`,
	`POSTGRES_PASSWORD=${hex()}`,
	`APP_DB_PASSWORD=${hex()}`,
	`AUTH_DB_PASSWORD=${hex()}`,
	`GOTRUE_JWT_SECRET=${hex()}`,
	`PAIRSIGHT_SECRET_KEY=${randomBytes(SECRET_BYTES).toString('base64')}`
]
writeFileSync(values.out, `${lines.join('\n')}\n`, { mode: 0o600 })
console.log(`Wrote ${values.out}. Keep it: losing it locks you out of this install's data.`)
