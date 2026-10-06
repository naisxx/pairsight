#!/usr/bin/env node
// The Splink service's gates (docs/rules/splink-service.md): lint, format
// and tests, through its virtual environment. Run by local-review and CI.
//
// Usage: pnpm python:check   (after pnpm splink:setup)

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { serviceDir, venvPython } from './splink-paths.mjs'

if (!existsSync(venvPython)) {
	console.error('No services/splink/.venv: run `pnpm splink:setup` first.')
	process.exit(1)
}
const steps = [
	['ruff', 'check', '.'],
	['ruff', 'format', '--check', '.'],
	['pytest', '-q']
]
for (const [tool, ...args] of steps) {
	console.log(`\n> ${tool} ${args.join(' ')}`)
	try {
		execFileSync(venvPython, ['-m', tool, ...args], { cwd: serviceDir, stdio: 'inherit' })
	} catch {
		process.exit(1)
	}
}
