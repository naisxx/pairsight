// Where the Splink service and its virtual environment live, for the setup
// and check scripts (the app resolves the same path in
// src/server/pairsight/splink/service.ts).
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const serviceDir = fileURLToPath(new URL('../services/splink/', import.meta.url))
export const venvPython = path.join(
	serviceDir,
	'.venv',
	process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
)
