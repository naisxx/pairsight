#!/usr/bin/env node
// Sets up the Splink service (services/splink) for local use: a virtual
// environment at services/splink/.venv with the pinned requirements and the
// dev tools (ruff, pytest). Safe to run again; it brings the venv in line.
//
// Usage: pnpm splink:setup   (needs Python 3.13 as `python`, or PYTHON=…)

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { serviceDir, venvPython } from './splink-paths.mjs'

const python = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3')
const run = (command, args) => execFileSync(command, args, { cwd: serviceDir, stdio: 'inherit' })

if (!existsSync(venvPython)) {
	console.log(`Creating services/splink/.venv with ${python}…`)
	run(python, ['-m', 'venv', '.venv'])
}
run(venvPython, ['-m', 'pip', 'install', '--quiet', '--upgrade', 'pip'])
run(venvPython, ['-m', 'pip', 'install', '--quiet', '-r', 'requirements-dev.txt'])
console.log('Splink service ready: the run worker finds services/splink/.venv by itself.')
